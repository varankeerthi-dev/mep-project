import React, { useState } from 'react';
import { Plus, FilePlus2, ChevronUp, ChevronDown, Folder, Link2, AlertTriangle } from 'lucide-react';
import { PO_STATUS_CONFIG } from '../../constants';
import { Button } from '@/components/ui/button';

interface TransactionsTabProps {
  selectedProject: any;
  activeTransactionTab: string;
  setActiveTransactionTab: (tab: string) => void;
  projectPOs: any[];
  projectInvoices: any[];
  projectExpenses: any[];
  projectPayments: any[];
  projectMaterials: any[];
  projectJointMeasurements: any[];
  financialSummary: any;
  linkedSummary: any;
  linkedLoading: boolean;
  linkedData: any;
  setInvoiceModal: (val: any) => void;
  navigate: (path: string) => void;
  fmt: (val: any) => string;
  fmtD: (val: any) => string;
}

export function TransactionsTab({
  selectedProject,
  activeTransactionTab,
  setActiveTransactionTab,
  projectPOs,
  projectInvoices,
  projectExpenses,
  projectPayments,
  projectMaterials,
  projectJointMeasurements,
  financialSummary,
  linkedSummary,
  linkedLoading,
  linkedData,
  setInvoiceModal,
  navigate,
  fmt,
  fmtD,
}: TransactionsTabProps) {
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  const transactionSubTabs: Array<{
    id: 'po-utilization' | 'pos' | 'invoices' | 'payments' | 'reconciliation';
    label: string;
    count: number;
  }> = [
    { id: 'po-utilization', label: 'PO Utilization', count: projectPOs.length },
    { id: 'pos', label: 'POs', count: projectPOs.length },
    { id: 'invoices', label: 'Invoices', count: projectInvoices.length },
    { id: 'payments', label: 'Payments', count: projectPayments.length },
    { id: 'reconciliation', label: 'Material Reconciliation', count: projectMaterials.length },
  ];

  return (
    <div>
      {/* Transactions Summary */}
      <div className="pl-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="pl-summary-title" style={{ margin: 0 }}>Transaction Summary</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="default" size="sm" onClick={() => navigate(`/client-po/create?project_id=${selectedProject.id}`)}
            >
              <Plus size={16} />
              Create PO
            </Button>
            <Button variant="default" size="sm" onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: null })}
              style={{
                background: '#fff',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <FilePlus2 size={16} />
              Create Invoice
            </Button>
          </div>
        </div>
        <div className="pl-financial-grid">
          <div className="pl-financial-card">
            <div className="pl-financial-label">Total POs</div>
            <div className="pl-financial-value">{projectPOs.length}</div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">PO Value</div>
            <div className="pl-financial-value">{fmt(linkedSummary?.totalPOValue ?? financialSummary?.total_po_value)}</div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">Invoice Utilised</div>
            <div
              className="pl-financial-value"
              title="Sum of invoices linked to POs (auto-tracked via trigger)"
              style={{ color: 'var(--accent, #2563eb)' }}
            >
              {fmt(linkedSummary?.totalUtilized)}
            </div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">Unlinked Invoices</div>
            <div
              className="pl-financial-value"
              title="Invoices without a PO link"
              style={{ color: linkedSummary && linkedSummary.invoicedWithoutPO > 0 ? '#d97706' : undefined }}
            >
              {fmt(linkedSummary?.invoicedWithoutPO)}
            </div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">PO Balance</div>
            <div className="pl-financial-value">{fmt(linkedSummary?.poBalance ?? financialSummary?.po_balance)}</div>
          </div>
        </div>
      </div>

      {/* Transaction Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
        {transactionSubTabs.map(subTab => {
          const isActive = activeTransactionTab === subTab.id;
          return (
            <Button variant="default" size="sm" key={subTab.id} onClick={() => setActiveTransactionTab(subTab.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: isActive ? 'var(--accent, #2563eb)' : 'white',
                color: isActive ? 'white' : 'var(--text-primary)',
                transition: 'all 0.15s ease',
              }}
            >
              {subTab.label} ({subTab.count})
            </Button>
          );
        })}
      </div>

      {/* ── PO Utilization (linked view) ── */}
      {activeTransactionTab === 'po-utilization' && (
        <div className="pl-card">
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>PO → Invoice Utilization</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Each PO tracks its own invoiced value. Click a row to see the linked invoices.
              </p>
            </div>
          </div>
          {linkedLoading ? (
            <div className="pl-empty">Loading…</div>
          ) : !linkedSummary || linkedSummary.perPO.length === 0 ? (
            <div className="pl-empty">
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No purchase orders found. Create a PO to start tracking utilization.</p>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>PO Number</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'left' }}>PO Value</th>
                  <th style={{ textAlign: 'left' }}>Invoice Utilised</th>
                  <th style={{ textAlign: 'left' }}>Balance</th>
                  <th style={{ minWidth: 140 }}>Utilization</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {linkedSummary.perPO.map(({ po, invoiced, available, utilizationPct, overInvoiced, invoices: linkedInvoices }: any) => {
                  const isExpanded = expandedPoId === po.id;
                  const poTotal = Number(po.po_total_value) || 0;
                  const statusCfg = PO_STATUS_CONFIG[po.status as keyof typeof PO_STATUS_CONFIG];
                  const statusColor = statusCfg?.dot || '#94a3b8';
                  return (
                    <React.Fragment key={po.id}>
                      <tr
                        onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td style={{ fontWeight: 500 }}>{po.po_number}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtD(po.po_date)}</td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, textAlign: 'left' }}>
                          {fmt(poTotal)}
                        </td>
                        <td
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 500,
                            textAlign: 'left',
                            color: overInvoiced ? '#dc2626' : 'var(--accent, #2563eb)',
                          }}
                          title={overInvoiced ? 'Invoiced exceeds PO total' : 'Sum of linked invoices'}
                        >
                          {fmt(invoiced)}
                        </td>
                        <td
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 500,
                            textAlign: 'left',
                            color: available < 0 ? '#dc2626' : 'var(--text-primary)',
                          }}
                        >
                          {fmt(available)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                background: '#f1f5f9',
                                borderRadius: 3,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${utilizationPct}%`,
                                  height: '100%',
                                  background: overInvoiced
                                    ? '#dc2626'
                                    : utilizationPct >= 90
                                      ? '#d97706'
                                      : 'var(--accent, #2563eb)',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                minWidth: 32,
                                textAlign: 'right',
                              }}
                            >
                              {utilizationPct}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="pl-status">
                            <span className="pl-status-dot" style={{ background: statusColor }} />
                            {po.status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <Button variant="default" size="sm" onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: po.id })}
                            style={{
                              background: 'var(--accent, #2563eb)',
                              color: '#fff',
                              border: 'none',
                              padding: '0.375rem 0.625rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Plus size={12} /> Invoice
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${po.id}-expanded`} style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
                          <td colSpan={9} style={{ padding: '0.75rem 1.5rem' }}>
                            {linkedInvoices.length === 0 ? (
                              <div
                                style={{
                                  padding: '0.75rem',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.8125rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <Link2 size={12} /> No invoices linked to this PO yet.
                                <Button variant="default" size="sm" onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: po.id })}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--accent, #2563eb)',
                                    fontSize: '0.8125rem',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Create the first invoice
                                </Button>
                              </div>
                            ) : (
                              <table style={{ width: '100%', fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Invoice #</th>
                                    <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Date</th>
                                    <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Amount</th>
                                    <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Status</th>
                                    <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {linkedInvoices.map((inv: any) => (
                                    <tr key={inv.id}>
                                      <td style={{ padding: '0.375rem 0.5rem', fontWeight: 500 }}>{inv.invoice_number}</td>
                                      <td style={{ padding: '0.375rem 0.5rem', color: 'var(--text-secondary)' }}>{fmtD(inv.invoice_date)}</td>
                                      <td
                                        style={{
                                          padding: '0.375rem 0.5rem',
                                          textAlign: 'left',
                                          fontFamily: 'JetBrains Mono, monospace',
                                        }}
                                      >
                                        {fmt(inv.total_amount)}
                                      </td>
                                      <td style={{ padding: '0.375rem 0.5rem' }}>
                                        <span className="pl-status">{inv.status || 'Pending'}</span>
                                      </td>
                                      <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>
                                        <Button variant="default" size="sm" onClick={() => setInvoiceModal({ open: true, mode: 'edit', invoice: inv })}
                                          style={{
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-secondary)',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.6875rem',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Edit
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── POs (raw list) ── */}
      {activeTransactionTab === 'pos' && (
        <div className="pl-card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Purchase Orders</h3>
            <Button variant="default" size="sm" onClick={() => navigate(`/client-po/create?project_id=${selectedProject.id}`)}>
              <Plus size={16} />
              Create PO
            </Button>
          </div>
          {projectPOs.length === 0 ? (
            <div className="pl-empty">
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No purchase orders found</p>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'left' }}>Total Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectPOs.map(po => (
                  <tr key={po.id}>
                    <td style={{ fontWeight: 500 }}>{po.po_number}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmtD(po.po_date)}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, textAlign: 'left' }}>{fmt(po.po_total_value)}</td>
                    <td>
                      <span className="pl-status">
                        <span className="pl-status-dot" style={{ background: PO_STATUS_CONFIG[po.status as keyof typeof PO_STATUS_CONFIG]?.dot || '#94a3b8' }} />
                        {po.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Invoices (raw list, with linked PO) ── */}
      {activeTransactionTab === 'invoices' && (
        <div className="pl-card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Invoices</h3>
            <Button variant="default" size="sm" onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: null })}
            >
              <Plus size={16} />
              Create Invoice
            </Button>
          </div>
          {projectInvoices.length === 0 ? (
            <div className="pl-empty">
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No invoices found</p>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Linked PO</th>
                  <th style={{ textAlign: 'left' }}>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {projectInvoices.map(inv => {
                  const linkedPo = linkedData?.pos.find((p: any) => p.id === inv.po_id);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{fmtD(inv.invoice_date)}</td>
                      <td>
                        {linkedPo ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.125rem 0.5rem',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                            }}
                          >
                            <Link2 size={10} /> {linkedPo.po_number}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: '#d97706',
                              fontSize: '0.75rem',
                            }}
                            title="This invoice is not linked to a PO. Link it to track PO utilization."
                          >
                            <AlertTriangle size={10} /> Unlinked
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, textAlign: 'left' }}>{fmt(inv.total_amount)}</td>
                      <td><span className="pl-status">{inv.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <Button variant="default" size="sm" onClick={() => setInvoiceModal({ open: true, mode: 'edit', invoice: inv })}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Payments (raw list) ── */}
      {activeTransactionTab === 'payments' && (
        <div className="pl-card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Payments</h3>
          </div>
          {projectPayments.length === 0 ? (
            <div className="pl-empty">
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No payments found</p>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'left' }}>Amount</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {projectPayments.map(pay => (
                  <tr key={pay.id}>
                    <td style={{ fontWeight: 500 }}>{pay.payment_number}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmtD(pay.payment_date)}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--success)', textAlign: 'left' }}>{fmt(pay.payment_amount)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{pay.payment_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Material Reconciliation / Variance ── */}
      {activeTransactionTab === 'reconciliation' && (
        <div className="pl-card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Material Reconciliation & Variance</h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Tracks quantity variances from BOQ Budget vs Inwarded (delivered to site) vs Installed (as per JMS sign-offs).
              </p>
            </div>
          </div>
          {projectMaterials.length === 0 ? (
            <div className="pl-empty">
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No project materials logged</p>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Material Name & Variant</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'left' }}>BOQ Budget (Planned)</th>
                  <th style={{ textAlign: 'left' }}>Inwarded (Delivered)</th>
                  <th style={{ textAlign: 'left' }}>Installed (JMS)</th>
                  <th style={{ textAlign: 'left' }}>On-Site Balance</th>
                  <th style={{ textAlign: 'left' }}>BOQ vs Installed Var.</th>
                  <th style={{ textAlign: 'left' }}>Wastage %</th>
                </tr>
              </thead>
              <tbody>
                {projectMaterials.map((mat: any) => {
                  const materialName = mat.materials?.name || 'Unknown Material';
                  const variantName = mat.company_variants?.variant_name || '';
                  const materialFullName = `${materialName} ${variantName}`.trim();
                  
                  const planned = parseFloat(mat.planned_qty) || 0;
                  const inwarded = parseFloat(mat.received_qty) || 0;
                  
                  // Calculate installed qty from completed JMS reports
                  let installed = 0;
                  projectJointMeasurements.forEach((jms: any) => {
                    if (Array.isArray(jms.measured_items)) {
                      jms.measured_items.forEach((itm: any) => {
                        const jmsItemName = (itm.item_name || '').toLowerCase().trim();
                        const matLower = materialName.toLowerCase().trim();
                        const fullLower = materialFullName.toLowerCase().trim();
                        if (jmsItemName === fullLower || jmsItemName === matLower) {
                          installed += (parseFloat(itm.agreed_qty) || 0);
                        }
                      });
                    }
                  });

                  const onSiteBalance = inwarded - installed;
                  const boqVariance = planned - installed;
                  const wastagePercent = inwarded > 0 ? (onSiteBalance / inwarded) * 100 : 0;
                  const isHighWastage = wastagePercent > 3;

                  return (
                    <tr key={mat.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {materialFullName}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{mat.materials?.unit || mat.unit}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left', fontWeight: 500 }}>
                        {planned.toFixed(2)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left', fontWeight: 500, color: '#2563eb' }}>
                        {inwarded.toFixed(2)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left', fontWeight: 500, color: '#10b981' }}>
                        {installed.toFixed(2)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'left', fontWeight: 500 }}>
                        {onSiteBalance.toFixed(2)}
                      </td>
                      <td style={{ 
                        fontFamily: 'JetBrains Mono, monospace', 
                        textAlign: 'left', 
                        fontWeight: 500,
                        color: boqVariance < 0 ? '#ef4444' : 'inherit'
                      }}>
                        {boqVariance.toFixed(2)}
                      </td>
                      <td style={{ 
                        fontFamily: 'JetBrains Mono, monospace', 
                        textAlign: 'left', 
                        fontWeight: 600,
                        color: isHighWastage ? '#ef4444' : '#10b981'
                      }}>
                        {wastagePercent.toFixed(1)}%
                        {isHighWastage && (
                          <span style={{ marginLeft: '4px', fontSize: '10px', background: '#fee2e2', color: '#ef4444', padding: '1px 4px', borderRadius: '4px' }}>
                            High Wastage
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
