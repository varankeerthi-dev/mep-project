import React, { useState, useCallback, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Loader2, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

function formatCurrency(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Party360Props = {
  partyName: string;
  vendorId?: string | null;
  clientId?: string | null;
  onClose: () => void;
};

export const Party360: React.FC<Party360Props> = ({ partyName, vendorId, clientId, onClose }) => {
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'receivables' | 'payables'>('overview');

  // Fetch client-side transactions (receivables)
  const clientTransactions = useQuery({
    queryKey: ['party360', 'client', clientId],
    queryFn: async () => {
      if (!clientId || !organisation?.id) return { invoices: [], receipts: [], creditNotes: [], total: 0 };
      const [invoicesRes, receiptsRes, cnRes] = await Promise.all([
        supabase.from('invoices').select('id, invoice_no, invoice_date, total').eq('organisation_id', organisation.id).eq('client_id', clientId).order('invoice_date', { ascending: false }),
        supabase.from('receipts').select('id, receipt_no, receipt_date, amount, remarks').eq('org_id', organisation.id).eq('client_id', clientId).order('receipt_date', { ascending: false }),
        supabase.from('credit_notes').select('id, cn_number, cn_date, total_amount').eq('organisation_id', organisation.id).eq('client_id', clientId).eq('approval_status', 'Approved').order('cn_date', { ascending: false }),
      ]);
      const invoices = invoicesRes.data || [];
      const receipts = receiptsRes.data || [];
      const creditNotes = cnRes.data || [];
      const totalInvoices = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
      const totalReceipts = receipts.reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalCNs = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
      return { invoices, receipts, creditNotes, total: totalInvoices - totalReceipts - totalCNs };
    },
    enabled: !!clientId && !!organisation?.id,
  });

  // Fetch vendor-side transactions (payables)
  const vendorTransactions = useQuery({
    queryKey: ['party360', 'vendor', vendorId],
    queryFn: async () => {
      if (!vendorId || !organisation?.id) return { bills: [], payments: [], debitNotes: [], total: 0 };
      const [billsRes, paymentsRes, dnRes] = await Promise.all([
        supabase.from('purchase_bills').select('id, bill_number, bill_date, total_amount').eq('organisation_id', organisation.id).eq('vendor_id', vendorId).order('bill_date', { ascending: false }),
        supabase.from('purchase_payments').select('id, payment_date, amount, remarks').eq('organisation_id', organisation.id).eq('vendor_id', vendorId).order('payment_date', { ascending: false }),
        supabase.from('debit_notes').select('id, dn_number, dn_date, total_amount').eq('organisation_id', organisation.id).eq('vendor_id', vendorId).eq('approval_status', 'Approved').order('dn_date', { ascending: false }),
      ]);
      const bills = billsRes.data || [];
      const payments = paymentsRes.data || [];
      const debitNotes = dnRes.data || [];
      const totalBills = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
      const totalPayments = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const totalDNs = debitNotes.reduce((s, d) => s + Number(d.total_amount || 0), 0);
      return { bills, payments, debitNotes, total: totalBills - totalPayments - totalDNs };
    },
    enabled: !!vendorId && !!organisation?.id,
  });

  const receivables = clientTransactions.data?.total ?? 0;
  const payables = vendorTransactions.data?.total ?? 0;
  const netPosition = receivables - payables;

  const isLoading = clientTransactions.isLoading || vendorTransactions.isLoading;

  const navigateToClient = useCallback(() => {
    if (clientId) window.location.href = `/ledger`;
  }, [clientId]);

  const navigateToVendor = useCallback(() => {
    if (vendorId) window.dispatchEvent(new CustomEvent('navigate-purchase', { detail: { tab: 'vendors' } }));
  }, [vendorId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '700px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e5e5e5' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#171717' }}>Party 360°</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#737373' }}>{partyName}</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f5f5f5', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#525252' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', padding: '0 24px' }}>
          {(['overview', 'receivables', 'payables'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px', fontSize: '13px', fontWeight: 600, border: 'none', borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab ? '#2563eb' : '#737373', background: 'transparent', cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#a3a3a3' }}>
              <Loader2 size={24} className="animate-spin" />
              <span style={{ marginLeft: '12px' }}>Loading...</span>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    {/* Receivables */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={16} style={{ color: '#16a34a' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>Receivables</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803d' }}>{formatCurrency(receivables)}</div>
                      <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px' }}>
                        {clientTransactions.data?.invoices.length ?? 0} invoices
                      </div>
                    </div>

                    {/* Payables */}
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingDown size={16} style={{ color: '#dc2626' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b' }}>Payables</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: '#b91c1c' }}>{formatCurrency(payables)}</div>
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>
                        {vendorTransactions.data?.bills.length ?? 0} bills
                      </div>
                    </div>

                    {/* Net Position */}
                    <div style={{ background: netPosition >= 0 ? '#eff6ff' : '#fefce8', border: `1px solid ${netPosition >= 0 ? '#bfdbfe' : '#fde68a'}`, borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Minus size={16} style={{ color: netPosition >= 0 ? '#2563eb' : '#ca8a04' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: netPosition >= 0 ? '#1e40af' : '#854d0e' }}>Net Position</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: netPosition >= 0 ? '#1d4ed8' : '#a16207' }}>
                        {formatCurrency(Math.abs(netPosition))}
                      </div>
                      <div style={{ fontSize: '11px', color: netPosition >= 0 ? '#60a5fa' : '#facc15', marginTop: '4px' }}>
                        {netPosition >= 0 ? 'They owe you' : 'You owe them'}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    {clientId && (
                      <button onClick={navigateToClient} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '8px', background: '#fff', fontSize: '12px', fontWeight: 600, color: '#525252', cursor: 'pointer' }}>
                        <ExternalLink size={14} /> View Client Ledger
                      </button>
                    )}
                    {vendorId && (
                      <button onClick={navigateToVendor} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '8px', background: '#fff', fontSize: '12px', fontWeight: 600, color: '#525252', cursor: 'pointer' }}>
                        <ExternalLink size={14} /> View Vendor Ledger
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'receivables' && (
                <div>
                  {!clientId ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#a3a3a3', fontSize: '13px' }}>No client record linked</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#171717' }}>Invoices ({clientTransactions.data?.invoices.length ?? 0})</h3>
                      {clientTransactions.data?.invoices.map(inv => (
                        <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{inv.invoice_no}</div>
                            <div style={{ fontSize: '11px', color: '#737373' }}>{inv.invoice_date}</div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#16a34a' }}>{formatCurrency(Number(inv.total || 0))}</div>
                        </div>
                      ))}
                      <h3 style={{ margin: '16px 0 0', fontSize: '14px', fontWeight: 600, color: '#171717' }}>Payments ({clientTransactions.data?.receipts.length ?? 0})</h3>
                      {clientTransactions.data?.receipts.map(rcpt => (
                        <div key={rcpt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{rcpt.receipt_no || 'Payment'}</div>
                            <div style={{ fontSize: '11px', color: '#737373' }}>{rcpt.receipt_date}</div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>-{formatCurrency(Number(rcpt.amount || 0))}</div>
                        </div>
                      ))}
                      {clientTransactions.data?.creditNotes.length > 0 && (
                        <>
                          <h3 style={{ margin: '16px 0 0', fontSize: '14px', fontWeight: 600, color: '#171717' }}>Credit Notes ({clientTransactions.data.creditNotes.length})</h3>
                          {clientTransactions.data.creditNotes.map(cn => (
                            <div key={cn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: '8px' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{cn.cn_number}</div>
                                <div style={{ fontSize: '11px', color: '#737373' }}>{cn.cn_date}</div>
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>-{formatCurrency(Number(cn.total_amount || 0))}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payables' && (
                <div>
                  {!vendorId ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#a3a3a3', fontSize: '13px' }}>No vendor record linked</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#171717' }}>Bills ({vendorTransactions.data?.bills.length ?? 0})</h3>
                      {vendorTransactions.data?.bills.map(bill => (
                        <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{bill.bill_number}</div>
                            <div style={{ fontSize: '11px', color: '#737373' }}>{bill.bill_date}</div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>{formatCurrency(Number(bill.total_amount || 0))}</div>
                        </div>
                      ))}
                      <h3 style={{ margin: '16px 0 0', fontSize: '14px', fontWeight: 600, color: '#171717' }}>Payments ({vendorTransactions.data?.payments.length ?? 0})</h3>
                      {vendorTransactions.data?.payments.map(pmt => (
                        <div key={pmt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>Payment</div>
                            <div style={{ fontSize: '11px', color: '#737373' }}>{pmt.payment_date}</div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#16a34a' }}>-{formatCurrency(Number(pmt.amount || 0))}</div>
                        </div>
                      ))}
                      {vendorTransactions.data?.debitNotes.length > 0 && (
                        <>
                          <h3 style={{ margin: '16px 0 0', fontSize: '14px', fontWeight: 600, color: '#171717' }}>Debit Notes ({vendorTransactions.data.debitNotes.length})</h3>
                          {vendorTransactions.data.debitNotes.map(dn => (
                            <div key={dn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: '8px' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{dn.dn_number}</div>
                                <div style={{ fontSize: '11px', color: '#737373' }}>{dn.dn_date}</div>
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#16a34a' }}>-{formatCurrency(Number(dn.total_amount || 0))}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
