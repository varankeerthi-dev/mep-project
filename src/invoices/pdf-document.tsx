import React from 'react';
import {
  Document,
  Image,
  Page,
  PDFViewer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { InvoicePdfData } from './pdf-types';
import { getInvoiceDisplayNumber } from './ui-utils';
import { numberToIndianWords } from './utils/numberToWords';

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingRight: 28,
    paddingBottom: 30,
    paddingLeft: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  panel: {
    border: '1 solid #cbd5e1',
    borderRadius: 6,
    padding: 12,
  },
  headerPanel: {
    border: '1 solid #cbd5e1',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  headerTop: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  companyWrap: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    flexGrow: 1,
    paddingRight: 10,
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: 'contain',
    marginTop: 2,
  },
  companyText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flexGrow: 1,
  },
  titleWrap: {
    width: 140,
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 19,
    marginBottom: 4,
  },
  titleMeta: {
    fontSize: 8.5,
    color: '#475569',
    textAlign: 'right',
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
  },
  muted: {
    color: '#475569',
  },
  smallMuted: {
    color: '#64748b',
    fontSize: 8,
  },
  gridRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  gridCol: {
    flexGrow: 1,
    flexBasis: 0,
  },
  sectionLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  valueLine: {
    marginBottom: 3,
    fontSize: 9,
  },
  valueStrong: {
    fontFamily: 'Helvetica-Bold',
  },
  tableWrap: {
    border: '1 solid #cbd5e1',
    borderBottom: '0 solid #cbd5e1',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
  },
  tableHead: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    paddingTop: 7,
    paddingRight: 6,
    paddingBottom: 7,
    paddingLeft: 6,
    borderRight: '1 solid #e2e8f0',
    fontSize: 8.5,
    justifyContent: 'center',
  },
  lastCell: {
    borderRight: '0 solid #e2e8f0',
  },
  headText: {
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    fontSize: 7.6,
    letterSpacing: 0.4,
  },
  amountText: {
    textAlign: 'right',
  },
  amountInWords: {
    marginTop: 12,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    border: '1 solid #cbd5e1',
    borderRadius: 6,
  },
  amountInWordsLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#475569',
    marginBottom: 4,
  },
  amountInWordsText: {
    fontSize: 9,
    color: '#334155',
  },
  summaryArea: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-end',
  },
  noteBlock: {
    flexGrow: 1,
    flexBasis: 0,
    paddingRight: 12,
  },
  summaryBlock: {
    width: 210,
    border: '1 solid #cbd5e1',
    borderRadius: 6,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 12,
    backgroundColor: '#f8fafc',
  },
  summaryRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    fontSize: 9,
    color: '#334155',
  },
  totalRow: {
    borderTop: '1 solid #cbd5e1',
    marginTop: 7,
    paddingTop: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#0f172a',
  },
  footerLine: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1 solid #e2e8f0',
    fontSize: 7.5,
    color: '#64748b',
    textAlign: 'center',
  },
});

function formatCurrency(value?: number | null): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function stringValue(value: unknown, fallback = '-'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return fallback;
}

function getSourceReference(data: InvoicePdfData): string {
  if (!data.source) return stringValue(data.invoice.source_id);

  if (data.source.type === 'quotation') {
    return stringValue(data.source.header.reference ?? data.source.header.id);
  }

  if (data.source.type === 'challan') {
    return stringValue(data.source.header.challan_number ?? data.source.header.po_no ?? data.source.header.id);
  }

  return stringValue(data.source.header.po_number ?? data.source.header.id);
}

function getSourceLabel(data: InvoicePdfData): string {
  if (data.invoice.source_type === 'quotation') return 'Quotation Ref';
  if (data.invoice.source_type === 'challan') return 'Challan Ref';
  return 'PO Ref';
}

function getExtraColumnValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value || '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '-';
}

function getClientCustomColumns(data: InvoicePdfData) {
  const showCustomColumn = data.invoice.template_type === 'client_custom';
  const templateLabel = data.template?.layout_json?.extra_column_label;
  const itemLabel = data.invoice.items.find(
    (item) => typeof item.meta_json?.client_custom_label === 'string' && item.meta_json.client_custom_label.trim(),
  )?.meta_json?.client_custom_label;
  const extraColumnLabel = showCustomColumn
    ? stringValue(typeof templateLabel === 'string' && templateLabel.trim() ? templateLabel : itemLabel, 'Custom')
    : null;

  const widths = showCustomColumn
    ? ['30%', '12%', '12%', '10%', '14%', '22%']
    : ['42%', '14%', '10%', '14%', '20%'];

  return { showCustomColumn, extraColumnLabel, widths };
}

function InvoiceItemsTable({ data }: { data: InvoicePdfData }) {
  const { showCustomColumn, extraColumnLabel, widths } = getClientCustomColumns(data);

  return (
    <View style={styles.tableWrap}>
      <View style={[styles.tableRow, styles.tableHead]} fixed>
        <View style={[styles.tableCell, { width: widths[0] }]}>
          <Text style={styles.headText}>Description</Text>
        </View>
        {showCustomColumn && (
          <View style={[styles.tableCell, { width: widths[1] }]}>
            <Text style={styles.headText}>{extraColumnLabel}</Text>
          </View>
        )}
        <View style={[styles.tableCell, { width: widths[showCustomColumn ? 2 : 1] }]}>
          <Text style={styles.headText}>HSN</Text>
        </View>
        <View style={[styles.tableCell, { width: widths[showCustomColumn ? 3 : 2] }]}>
          <Text style={styles.headText}>Qty</Text>
        </View>
        <View style={[styles.tableCell, { width: widths[showCustomColumn ? 4 : 3] }]}>
          <Text style={styles.headText}>Rate</Text>
        </View>
        <View style={[styles.tableCell, styles.lastCell, { width: widths[showCustomColumn ? 5 : 4] }]}>
          <Text style={styles.headText}>Amount</Text>
        </View>
      </View>

      {data.invoice.items.map((item, index) => (
        <View key={`${item.invoice_id ?? data.invoice.id}-line-${index}`} style={styles.tableRow} wrap={false}>
          <View style={[styles.tableCell, { width: widths[0] }]}>
            <Text>{stringValue(item.description)}</Text>
          </View>
          {showCustomColumn && (
            <View style={[styles.tableCell, { width: widths[1] }]}>
              <Text>{getExtraColumnValue(item.meta_json?.client_custom_value)}</Text>
            </View>
          )}
          <View style={[styles.tableCell, { width: widths[showCustomColumn ? 2 : 1] }]}>
            <Text>{stringValue(item.hsn_code)}</Text>
          </View>
          <View style={[styles.tableCell, { width: widths[showCustomColumn ? 3 : 2] }]}>
            <Text style={styles.amountText}>{stringValue(item.qty, '0')}</Text>
          </View>
          <View style={[styles.tableCell, { width: widths[showCustomColumn ? 4 : 3] }]}>
            <Text style={styles.amountText}>{formatCurrency(item.rate)}</Text>
          </View>
          <View style={[styles.tableCell, styles.lastCell, { width: widths[showCustomColumn ? 5 : 4] }]}>
            <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function InvoiceMaterialsTable({ data }: { data: InvoicePdfData }) {
  if (data.invoice.mode !== 'lot' || data.materials.length === 0) return null;

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.sectionLabel}>Material List</Text>
      <View style={styles.tableWrap}>
        <View style={[styles.tableRow, styles.tableHead]} fixed>
          <View style={[styles.tableCell, { width: '72%' }]}>
            <Text style={styles.headText}>Product</Text>
          </View>
          <View style={[styles.tableCell, styles.lastCell, { width: '28%' }]}>
            <Text style={styles.headText}>Qty Used</Text>
          </View>
        </View>
        {data.materials.map((material, index) => (
          <View key={`${material.product_id}-${index}`} style={styles.tableRow} wrap={false}>
            <View style={[styles.tableCell, { width: '72%' }]}>
              <Text>{stringValue(material.product_name)}</Text>
            </View>
            <View style={[styles.tableCell, styles.lastCell, { width: '28%' }]}>
              <Text style={styles.amountText}>{stringValue(material.qty_used, '0')}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const company = data.company;
  const invoice = data.invoice;

  return (
    <Document title={getInvoiceDisplayNumber(invoice)} author={company?.name ?? undefined}>
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <View style={styles.headerPanel} wrap={false}>
            <View style={styles.headerTop}>
              <View style={styles.companyWrap}>
                {company?.logo_url ? <Image src={company.logo_url} style={styles.logo} /> : null}
                <View style={styles.companyText}>
                  <Text style={styles.companyName}>{company?.name ?? 'Organisation'}</Text>
                  <Text style={styles.muted}>{stringValue(company?.address)}</Text>
                  <Text style={styles.muted}>
                    GSTIN: {stringValue(company?.gstin)} | State: {stringValue(company?.state)}
                  </Text>
                  <Text style={styles.smallMuted}>
                    {stringValue(company?.phone, 'Phone not set')} | {stringValue(company?.email, 'Email not set')}
                  </Text>
                </View>
              </View>

              <View style={styles.titleWrap}>
                <Text style={styles.invoiceTitle}>Tax Invoice</Text>
                <Text style={styles.titleMeta}>{invoice.template_type.replace('_', ' ')}</Text>
                <Text style={styles.titleMeta}>{invoice.mode === 'lot' ? 'Lot mode' : 'Itemized mode'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.gridRow} wrap={false}>
            <View style={[styles.gridCol, styles.panel]}>
              <Text style={styles.sectionLabel}>Client Details</Text>
              <Text style={[styles.valueLine, styles.valueStrong]}>{stringValue(invoice.client?.name)}</Text>
              <Text style={styles.valueLine}>GSTIN: {stringValue(invoice.client?.gst_number)}</Text>
              <Text style={styles.valueLine}>State: {stringValue(invoice.client?.state)}</Text>
            </View>

            <View style={[styles.gridCol, styles.panel]}>
              <Text style={styles.sectionLabel}>Invoice Info</Text>
              <Text style={styles.valueLine}>Invoice No: {getInvoiceDisplayNumber(invoice)}</Text>
              <Text style={styles.valueLine}>Date: {formatDate(invoice.created_at)}</Text>
              <Text style={styles.valueLine}>
                {getSourceLabel(data)}: {getSourceReference(data)}
              </Text>
              <Text style={styles.valueLine}>Status: {invoice.status}</Text>
            </View>
          </View>

          <InvoiceItemsTable data={data} />
          <InvoiceMaterialsTable data={data} />

          <View style={styles.amountInWords} wrap={false}>
            <Text style={styles.amountInWordsLabel}>Amount in Words:</Text>
            <Text style={styles.amountInWordsText}>{numberToIndianWords(invoice.total)}</Text>
          </View>

          <View style={styles.summaryArea} wrap={false}>
            <View style={styles.noteBlock}>
              <Text style={styles.sectionLabel}>GST Notes</Text>
              <Text style={styles.muted}>
                {invoice.igst > 0
                  ? 'Interstate supply: IGST applied.'
                  : 'Intrastate supply: CGST and SGST applied.'}
              </Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Source: {stringValue(invoice.source_type)} | Template: {stringValue(invoice.template_type)}
              </Text>
            </View>

            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <Text>Subtotal</Text>
                <Text>{formatCurrency(invoice.subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text>CGST</Text>
                <Text>{formatCurrency(invoice.cgst)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text>SGST</Text>
                <Text>{formatCurrency(invoice.sgst)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text>IGST</Text>
                <Text>{formatCurrency(invoice.igst)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text>Total</Text>
                <Text>{formatCurrency(invoice.total)}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footerLine}>
          Generated dynamically from invoice, client, source, template, and organisation records.
        </Text>
      </Page>
    </Document>
  );
}

export function InvoicePdfPreview({
  data,
  width = '100%',
  height = '100%',
}: {
  data: InvoicePdfData;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <PDFViewer width={width} height={height} showToolbar>
      <InvoicePdfDocument data={data} />
    </PDFViewer>
  );
}
