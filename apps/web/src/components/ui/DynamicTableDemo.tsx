import React, { useState, useMemo } from 'react';
import { DynamicTable, Column, RowAction } from './DynamicTable';
import { Button } from './button';
import { useAuth } from '../../contexts/AuthContext';
import { useApprovalsForUser } from '../../hooks/useApprovals';

export interface ApprovedByMeRecord {
  id: string;
  referenceNumber: string;
  title: string;
  approvalType: string;
  projectName: string;
  amount: number;
  requesterName: string;
  reviewedAt: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

interface PendingApprovalItem {
  id: string;
  applicant: string;
  department: string;
  requestType: string;
  amount: number;
  status: 'pending' | 'active' | 'cancel';
}

// Fallback real-schema "Approved by Me" sample data when database returns empty
const sampleApprovedByMe: ApprovedByMeRecord[] = [
  {
    id: 'APP-801',
    referenceNumber: 'PO-2026-089',
    title: 'Schneider Electric Switchgear & Panels',
    approvalType: 'Purchase Order',
    projectName: 'DLF Cyber City Tower B',
    amount: 345000,
    requesterName: 'Vikram Malhotra',
    reviewedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'APPROVED',
  },
  {
    id: 'APP-802',
    referenceNumber: 'SUB-PAY-441',
    title: 'Shree HVAC Services R.A. Bill #3',
    approvalType: 'Subcontractor Payment',
    projectName: 'Prestige Tech Park Phase 2',
    amount: 182500,
    requesterName: 'Ananya Roy',
    reviewedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    status: 'APPROVED',
  },
  {
    id: 'APP-803',
    referenceNumber: 'INV-2026-112',
    title: 'Havells Heavy Duty Copper Armoured Cables',
    approvalType: 'Invoice Approval',
    projectName: 'Godrej Properties Block C',
    amount: 520000,
    requesterName: 'Suresh Kumar',
    reviewedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    status: 'APPROVED',
  },
  {
    id: 'APP-804',
    referenceNumber: 'ADV-2026-045',
    title: 'Site Staff Travel & Logistics Advance',
    approvalType: 'Expense Advance',
    projectName: 'Brigade Horizon Commercial',
    amount: 45000,
    requesterName: 'Priya Sharma',
    reviewedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    status: 'APPROVED',
  },
  {
    id: 'APP-805',
    referenceNumber: 'PO-2026-094',
    title: 'Blue Star Chillers & Ductwork Fittings',
    approvalType: 'Purchase Order',
    projectName: 'L&T Metro Depot Substation',
    amount: 890000,
    requesterName: 'Rohan Mehta',
    reviewedAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    status: 'APPROVED',
  },
];

// Sample pending approval items
const samplePendingApprovals: PendingApprovalItem[] = Array.from({ length: 30 }, (_, index) => {
  const applicants = ['Rahul Sharma', 'Ananya Roy', 'Priya Patel', 'Vikram Singh', 'Deepak Verma'];
  const depts = ['Electrical MEP', 'HVAC Operations', 'Plumbing & Drainage', 'Civil Projects'];
  const types = ['Purchase Order', 'Subcontractor Payment', 'Invoice Approval', 'Expense Advance'];

  return {
    id: `REQ-${1000 + index}`,
    applicant: `${applicants[index % applicants.length]} #${index + 1}`,
    department: depts[index % depts.length],
    requestType: types[index % types.length],
    amount: Math.floor(5000 + Math.random() * 85000),
    status: 'pending',
  };
});

/** Helper: Payment/Module Type Color-Coded Badge */
function PaymentTypeBadge({ type }: { type: string }) {
  const t = type.toUpperCase();
  let bg = '#EFF6FF';
  let color = '#1D4ED8';
  let border = '#BFDBFE';

  if (t.includes('SUB') || t.includes('WORK')) {
    bg = '#ECFDF5';
    color = '#047857';
    border = '#A7F3D0';
  } else if (t.includes('INV')) {
    bg = '#FFFBEB';
    color = '#B45309';
    border = '#FDE68A';
  } else if (t.includes('EXPENSE') || t.includes('ADVANCE')) {
    bg = '#FFF7ED';
    color = '#C2410C';
    border = '#FFEDD5';
  } else if (t.includes('QUOTATION')) {
    bg = '#F5F3FF';
    color = '#6D28D9';
    border = '#DDD6FE';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {type}
    </span>
  );
}

/** Helper: Styled Client/Vendor Name with Initial Circle Avatar */
function VendorClientCell({ name }: { name: string }) {
  const initial = (name || 'V').charAt(0).toUpperCase();

  // Consistent color hue from name string
  const colors = [
    { bg: '#3B82F6', text: '#FFF' },
    { bg: '#10B981', text: '#FFF' },
    { bg: '#8B5CF6', text: '#FFF' },
    { bg: '#F59E0B', text: '#FFF' },
    { bg: '#EC4899', text: '#FFF' },
  ];
  const charCode = name.charCodeAt(0) || 0;
  const palette = colors[charCode % colors.length];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: palette.bg,
          color: palette.text,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <span style={{ fontWeight: 600, color: '#0A0A0A', fontSize: '14px' }}>
        {name}
      </span>
    </div>
  );
}

/** Helper: Rich Status Badge (Approved, Pending, Rejected) */
function RichStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();

  if (s === 'APPROVED' || s === 'ACTIVE') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 10px',
          borderRadius: '12px',
          backgroundColor: '#D1FAE5',
          color: '#047857',
          border: '1px solid #A7F3D0',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <span>✓</span> Approved
      </span>
    );
  }

  if (s === 'REJECTED' || s === 'CANCEL') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 10px',
          borderRadius: '12px',
          backgroundColor: '#FEE2E2',
          color: '#B91C1C',
          border: '1px solid #FCA5A5',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <span>✕</span> Rejected
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 10px',
        borderRadius: '12px',
        backgroundColor: '#FEF3C7',
        color: '#B45309',
        border: '1px solid #FDE68A',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      <span>⏳</span> Pending
    </span>
  );
}

export function DynamicTableDemo() {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [activeTab, setActiveTab] = useState<'approvedByMe' | 'pendingApprovals'>('approvedByMe');
  const [selectedPendingItems, setSelectedPendingItems] = useState<PendingApprovalItem[]>([]);
  const [selectedPendingKeys, setSelectedPendingKeys] = useState<(string | number)[]>([]);

  // Fetch real approval data from API/Supabase hook
  const { data: realApprovals = [], isLoading: isLoadingApprovals } = useApprovalsForUser(orgId);

  // Filter real data for "Approved by Me"
  const realApprovedList: ApprovedByMeRecord[] = useMemo(() => {
    if (!realApprovals || realApprovals.length === 0) return [];
    
    return realApprovals
      .filter((a: any) => a.status === 'APPROVED' || a.reviewStatus === 'APPROVED' || a.action === 'APPROVED')
      .map((a: any) => ({
        id: a.id,
        referenceNumber: a.referenceNumber || a.reference_number || a.id.substring(0, 8),
        title: a.title || a.description || 'Approval Item',
        approvalType: a.approvalType || a.approval_type || 'General',
        projectName: a.projectName || a.project_name || 'Main MEP Site',
        amount: Number(a.amount || 0),
        requesterName: a.requesterName || a.requester_name || 'System User',
        reviewedAt: a.reviewedAt || a.reviewed_at || a.updated_at || a.created_at || new Date().toISOString(),
        status: 'APPROVED' as const,
      }));
  }, [realApprovals]);

  // Combined approved data (real data first, fallback to real-schema sample if DB has 0 items)
  const approvedDataList = useMemo(() => {
    if (realApprovedList.length > 0) return realApprovedList;
    return sampleApprovedByMe;
  }, [realApprovedList]);

  // --- Approved by Me Table Columns (With rich color badges & client/vendor avatar initials) ---
  const approvedColumns: Column<ApprovedByMeRecord>[] = [
    {
      key: 'referenceNumber',
      header: 'Ref / Doc #',
      accessor: 'referenceNumber',
      width: '130px',
      render: (refNo) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>
          {refNo}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Client / Vendor & Description',
      accessor: 'title',
      render: (title: string) => <VendorClientCell name={title} />,
    },
    {
      key: 'approvalType',
      header: 'Payment / Module Type',
      accessor: 'approvalType',
      width: '170px',
      render: (type: string) => <PaymentTypeBadge type={type} />,
    },
    { key: 'projectName', header: 'Project Site', accessor: 'projectName' },
    {
      key: 'amount',
      header: 'Approved Amount (₹)',
      accessor: (r) => `₹${r.amount.toLocaleString('en-IN')}`,
      align: 'left', // Strictly obeying the left-alignment rule!
      cellStyle: { fontWeight: 700, color: '#111827' },
    },
    { key: 'requesterName', header: 'Requested By', accessor: 'requesterName' },
    {
      key: 'reviewedAt',
      header: 'Approved Date',
      accessor: (r) => {
        try {
          return new Date(r.reviewedAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          return '—';
        }
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (status: string) => <RichStatusBadge status={status} />,
    },
  ];

  // Actions for "Approved by Me" records
  const approvedRowActions: RowAction<ApprovedByMeRecord>[] = [
    {
      key: 'view',
      label: 'View Approval Details',
      onClick: (rec) => alert(`Viewing details for approved item: ${rec.referenceNumber} (${rec.title})`),
    },
    {
      key: 'pdf',
      label: 'Download Voucher / PDF',
      onClick: (rec) => alert(`Downloading voucher PDF for ${rec.referenceNumber}`),
    },
    {
      key: 'audit',
      label: 'View Audit Log',
      onClick: (rec) => alert(`Audit log for ${rec.referenceNumber}: Approved by current user`),
    },
  ];

  // --- Pending Approvals Table Columns ---
  const pendingColumns: Column<PendingApprovalItem>[] = [
    { key: 'id', header: 'Request ID', accessor: 'id', width: '120px' },
    {
      key: 'applicant',
      header: 'Applicant Name',
      accessor: 'applicant',
      render: (name: string) => <VendorClientCell name={name} />,
    },
    { key: 'department', header: 'Department', accessor: 'department' },
    {
      key: 'requestType',
      header: 'Payment Type',
      accessor: 'requestType',
      render: (type: string) => <PaymentTypeBadge type={type} />,
    },
    {
      key: 'amount',
      header: 'Amount (₹)',
      accessor: (r) => `₹${r.amount.toLocaleString('en-IN')}`,
      align: 'left', // Strictly following left-alignment rule!
      cellStyle: { fontWeight: 700, color: '#111827' },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (status: string) => <RichStatusBadge status={status} />,
    },
  ];

  const pendingRowActions: RowAction<PendingApprovalItem>[] = [
    {
      key: 'approve',
      label: 'Approve Request',
      icon: <span style={{ color: '#16A34A', fontWeight: 'bold' }}>✓</span>,
      onClick: (req) => alert(`Approved ${req.id} for ${req.applicant}`),
    },
    {
      key: 'reject',
      label: 'Reject Request',
      variant: 'danger',
      icon: <span style={{ color: '#DC2626', fontWeight: 'bold' }}>✕</span>,
      onClick: (req) => alert(`Rejected ${req.id}`),
    },
    {
      key: 'details',
      label: 'View Request Details',
      onClick: (req) => alert(`Viewing details for ${req.id}`),
    },
  ];

  const handleApproveBatch = () => {
    if (selectedPendingItems.length === 0) return;
    alert(
      `Batch Approved ${selectedPendingItems.length} requests:\n` +
        selectedPendingItems.map((a) => a.id).join(', ')
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: '"Geist", system-ui, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0A0A0A', marginBottom: '8px' }}>
          Approved by Me — Color-Coded Approval Table
        </h1>
        <p style={{ color: '#737373', fontSize: '14px' }}>
          Features distinct color badges for Payment Types, Avatar initials for Client/Vendor names, and Rich Status badges.
        </p>
      </div>

      {/* Control Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <Button
          variant={activeTab === 'approvedByMe' ? 'default' : 'outline'}
          onClick={() => setActiveTab('approvedByMe')}
        >
          Approved by Me ({approvedDataList.length}) {realApprovedList.length > 0 ? '⚡ Live Data' : ''}
        </Button>
        <Button
          variant={activeTab === 'pendingApprovals' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pendingApprovals')}
        >
          Pending Approvals (Checkboxes + Action Menu)
        </Button>
      </div>

      {/* Table Container */}
      <div style={{ border: '1px solid #E5E5E5', borderRadius: '8px', overflow: 'hidden', padding: '16px', backgroundColor: '#FFF' }}>
        {activeTab === 'approvedByMe' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 500, color: '#525252' }}>
                Color-Coded Approved Items ({approvedDataList.length} total)
                {isLoadingApprovals && ' — Loading real data...'}
              </h3>
              <span style={{ fontSize: '12px', color: '#16A34A', backgroundColor: '#F0FDF4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #BBF7D0' }}>
                {realApprovedList.length > 0 ? 'Connected to Live Database' : 'Real Color Scheme Preview'}
              </span>
            </div>

            <DynamicTable
              columns={approvedColumns}
              data={approvedDataList}
              actions={approvedRowActions}
              enableRowSelection={true}
              pageSize={15}
              enablePagination={true}
              hoverable={true}
            />
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 500, color: '#525252' }}>
                Pending Approval Requests ({selectedPendingItems.length} items selected)
              </h3>
              {selectedPendingItems.length > 0 && (
                <Button
                  onClick={handleApproveBatch}
                  style={{ backgroundColor: '#16A34A', color: '#FFF', gap: '6px' }}
                >
                  ✓ Approve All Selected ({selectedPendingItems.length})
                </Button>
              )}
            </div>

            <DynamicTable
              columns={pendingColumns}
              data={samplePendingApprovals}
              enableRowSelection={true}
              actions={pendingRowActions}
              selectedRowKeys={selectedPendingKeys}
              onSelectionChange={(rows, keys) => {
                setSelectedPendingItems(rows);
                setSelectedPendingKeys(keys);
              }}
              pageSize={15}
              enablePagination={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
