import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { getInvoiceDisplayNumber } from './ui-utils';

interface InvoiceItem {
  id?: string;
  description: string;
  hsn_code?: string;
  quantity: number;
  rate: number;
  amount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  unit?: string;
}

interface InvoiceWithRelations {
  id: string;
  invoice_number?: string;
  invoice_prefix?: string;
  invoice_date?: string;
  quotation_ref?: string;
  due_date?: string;
  po_number?: string;
  terms_conditions?: string;
  invoice_items?: InvoiceItem[];
}

const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0f172a',
  },
  headerBorder: {
    border: '1 solid #c8d0d8',
    borderRadius: 2,
    marginBottom: 5,
  },
  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottom: '1 solid #e2e8f0',
  },
  companySection: {
    flexDirection: 'row',
    gap: 8,
  },
  companyLogo: {
    width: 25,
    height: 25,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 1,
  },
  companyGstin: {
    fontSize: 8,
    color: '#64748b',
  },
  docTypeSection: {
    alignItems: 'flex-end',
  },
  docType: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  docMode: {
    fontSize: 8,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoBox: {
    flex: 1,
    border: '1 solid #e2e8f0',
    marginTop: 5,
    marginRight: 3,
  },
  infoBoxLast: {
    flex: 1,
    border: '1 solid #e2e8f0',
    marginTop: 5,
  },
  boxHeader: {
    backgroundColor: '#f1f5f9',
    padding: 4,
    paddingLeft: 6,
  },
  boxHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
  },
  boxContent: {
    padding: 6,
    paddingLeft: 6,
  },
  label: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 1,
  },
  value: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  table: {
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3c3c3c',
    padding: 4,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    padding: 4,
    minHeight: 14,
  },
  tableCell: {
    fontSize: 7,
    textAlign: 'center',
  },
  descriptionCell: {
    fontSize: 7,
    textAlign: 'left',
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  summaryBox: {
    width: 60,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 8,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 8,
    textAlign: 'right',
  },
  summaryTotal: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    borderTop: '1 solid #000000',
    paddingTop: 2,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  signatureBox: {
    alignItems: 'center',
  },
  signatureLine: {
    width: 80,
    borderTop: '1 solid #cbd5e1',
    marginTop: 20,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#64748b',
  },
  termsSection: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  termsTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  termsList: {
    fontSize: 7,
    color: '#64748b',
  },
  bankDetailsSection: {
    marginTop: 10,
    padding: 8,
    border: '1 solid #e2e8f0',
    borderRadius: 4,
  },
  bankTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  bankInfo: {
    fontSize: 7,
    color: '#64748b',
  },
});

const colWidths = {
  sno: 10,
  description: 50,
  hsn: 15,
  qty: 12,
  unit: 12,
  rate: 20,
  amount: 25,
  cgst: 15,
  sgst: 15,
  igst: 15,
  total: 25,
};

interface ProGridInvoiceDocumentProps {
  invoice: InvoiceWithRelations;
  organisation: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin: string;
    state: string;
    logo_url?: string;
    bank_details?: {
      bank_name?: string;
      account_no?: string;
      ifsc?: string;
      branch?: string;
    };
  };
  client: {
    client_name: string;
    gstin?: string;
    state?: string;
    billing_address?: string;
  };
}

export const ProGridInvoiceDocument: React.FC<ProGridInvoiceDocumentProps> = ({
  invoice,
  organisation,
  client,
}) => {
  const items = invoice.invoice_items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const cgstTotal = items.reduce((sum, item) => sum + (item.cgst || 0), 0);
  const sgstTotal = items.reduce((sum, item) => sum + (item.sgst || 0), 0);
  const igstTotal = items.reduce((sum, item) => sum + (item.igst || 0), 0);
  const grandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;
  const roundOff = Math.round(grandTotal) - grandTotal;
  const roundedTotal = Math.round(grandTotal);

  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const numberToWords = (num: number): string => {
    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const numToWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
      if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
      if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
      return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
    };
    return numToWords(Math.floor(num)) + ' Rupees Only';
  };

  const terms = [
    'Payment due within 30 days',
    'Late payment attracts 18% p.a. interest',
    'Goods once sold cannot be taken back',
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.headerBorder}>
          <View style={styles.headerBox}>
            <View style={styles.companySection}>
              {organisation.logo_url && (
                <Image src={organisation.logo_url} style={styles.companyLogo} />
              )}
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{organisation.name}</Text>
                <Text style={styles.companyAddress}>{organisation.address}</Text>
                <Text style={styles.companyGstin}>
                  GSTIN: {organisation.gstin} | State: {organisation.state}
                </Text>
                <Text style={styles.companyGstin}>
                  Ph: {organisation.phone} | Email: {organisation.email}
                </Text>
              </View>
            </View>
            <View style={styles.docTypeSection}>
              <Text style={styles.docType}>Tax Invoice</Text>
              <Text style={styles.docMode}>Standard Itemized Mode</Text>
            </View>
          </View>
        </View>

        {/* Client & Invoice Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <View style={styles.boxHeader}>
              <Text style={styles.boxHeaderText}>BILL TO</Text>
            </View>
            <View style={styles.boxContent}>
              <Text style={styles.value}>{client.client_name}</Text>
              <Text style={styles.label}>GSTIN: {client.gstin || '-'}</Text>
              <Text style={styles.label}>State: {client.state || '-'}</Text>
              {client.billing_address && (
                <Text style={styles.label}>{client.billing_address}</Text>
              )}
            </View>
          </View>
          <View style={styles.infoBoxLast}>
            <View style={styles.boxHeader}>
              <Text style={styles.boxHeaderText}>INVOICE DETAILS</Text>
            </View>
            <View style={styles.boxContent}>
              <Text style={styles.label}>
                Invoice No: {invoice.invoice_number || getInvoiceDisplayNumber({ id: invoice.id, created_at: invoice.invoice_date || undefined })}
              </Text>
              <Text style={styles.label}>Date: {formatDate(invoice.invoice_date)}</Text>
              {invoice.quotation_ref && (
                <Text style={styles.label}>Quotation Ref: {invoice.quotation_ref}</Text>
              )}
              {invoice.due_date && (
                <Text style={styles.label}>Due Date: {formatDate(invoice.due_date)}</Text>
              )}
              {invoice.po_number && (
                <Text style={styles.label}>PO Number: {invoice.po_number}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { width: colWidths.sno }]}>S.No</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.description }]}>Description</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.hsn }]}>HSN</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.qty }]}>Qty</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.unit }]}>Unit</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.rate }]}>Rate</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.amount }]}>Amount</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.cgst }]}>CGST</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.sgst }]}>SGST</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.igst }]}>IGST</Text>
            <Text style={[styles.tableHeaderText, { width: colWidths.total }]}>Total</Text>
          </View>
          {items.map((item, index) => (
            <View key={item.id || index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: colWidths.sno }]}>{index + 1}</Text>
              <Text style={[styles.descriptionCell, { width: colWidths.description }]}>
                {item.description}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.hsn }]}>{item.hsn_code || '-'}</Text>
              <Text style={[styles.tableCell, { width: colWidths.qty }]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, { width: colWidths.unit }]}>{item.unit || 'Nos'}</Text>
              <Text style={[styles.tableCell, { width: colWidths.rate }]}>{formatCurrency(item.rate)}</Text>
              <Text style={[styles.tableCell, { width: colWidths.amount }]}>{formatCurrency(item.amount)}</Text>
              <Text style={[styles.tableCell, { width: colWidths.cgst }]}>
                {item.cgst ? formatCurrency(item.cgst) : '-'}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.sgst }]}>
                {item.sgst ? formatCurrency(item.sgst) : '-'}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.igst }]}>
                {item.igst ? formatCurrency(item.igst) : '-'}
              </Text>
              <Text style={[styles.tableCell, { width: colWidths.total }]}>
                {formatCurrency(
                  item.amount + (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)
                )}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            {cgstTotal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>CGST:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(cgstTotal)}</Text>
              </View>
            )}
            {sgstTotal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>SGST:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(sgstTotal)}</Text>
              </View>
            )}
            {igstTotal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>IGST:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(igstTotal)}</Text>
              </View>
            )}
            {roundOff !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round Off:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(roundOff)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.summaryTotal]}>Grand Total:</Text>
              <Text style={[styles.summaryValue, styles.summaryTotal]}>{formatCurrency(roundedTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Amount in Words */}
        <View style={{ marginTop: 10, paddingLeft: '50%' }}>
          <Text style={{ fontSize: 8, color: '#64748b' }}>
            Amount in Words: {numberToWords(roundedTotal)}
          </Text>
        </View>

        {/* Terms & Conditions */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          {terms.map((term, i) => (
            <Text key={i} style={styles.termsList}>
              {i + 1}. {term}
            </Text>
          ))}
          {invoice.terms_conditions && (
            <Text style={styles.termsList}>{invoice.terms_conditions}</Text>
          )}
        </View>

        {/* Bank Details */}
        {organisation.bank_details && (
          <View style={styles.bankDetailsSection}>
            <Text style={styles.bankTitle}>Bank Details</Text>
            <Text style={styles.bankInfo}>
              Bank Name: {organisation.bank_details.bank_name || '-'} | Account No:{' '}
              {organisation.bank_details.account_no || '-'}
            </Text>
            <Text style={styles.bankInfo}>
              IFSC: {organisation.bank_details.ifsc || '-'} | Branch:{' '}
              {organisation.bank_details.branch || '-'}
            </Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Authorised Signatory</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>Client Signature</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};