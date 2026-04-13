import React from 'react';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

import type { GridMinimalColumns } from '../print-config';

export type GridMinimalMetaRow = { label: string; value: string };

export type GridMinimalParty = {
  label: string;
  name: string;
  address: string;
  gstin?: string;
};

export type GridMinimalOrg = {
  name: string;
  gstin?: string;
  address?: string;
  logoUrl?: string;
  bank?: {
    bankName?: string;
    accountNo?: string;
    branch?: string;
    ifsc?: string;
  };
};

export type GridMinimalItem = {
  id: string;
  sno: number;
  hsn?: string;
  description: string;
  make?: string;
  qty: number;
  unit?: string;
  rate: number;
  discPct?: number;
  gstPct?: number;
  amount: number;
};

export type GridMinimalTotals = {
  basicAmount: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  roundOff?: number;
  netValue: number;
  amountInWords?: string;
};

export type GridMinimalVM = {
  title: string;
  org: GridMinimalOrg;
  parties: GridMinimalParty[];
  meta: GridMinimalMetaRow[];
  items: GridMinimalItem[];
  totals: GridMinimalTotals;
  showTax: boolean;
  authorisedSignLabel?: string;
};

const fmt = (value: number, decimals = 2) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingRight: 28,
    paddingBottom: 24,
    paddingLeft: 28,
    fontFamily: 'Manrope',
    fontSize: 9.5,
    color: '#111827',
    display: 'flex',
    flexDirection: 'column',
  },
  contentWrapper: {
    borderLeft: '1 solid #9ca3af',
    borderRight: '1 solid #9ca3af',
    borderBottom: '1 solid #9ca3af',
  },
  title: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    paddingBottom: 6,
    borderBottom: '1.5 solid #111827',
  },
  headerOuter: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1 solid #9ca3af',
  },
  headerLeft: {
    width: '63%',
    borderRight: '1 solid #9ca3af',
  },
  headerRight: {
    width: '37%',
    display: 'flex',
    flexDirection: 'column',
  },
  orgBlock: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 10,
    borderBottom: '1 solid #9ca3af',
  },
  logoBox: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: 'contain',
  },
  orgName: { fontSize: 11.5, fontWeight: 700, lineHeight: 1.25 },
  orgGstin: { fontSize: 8.5, fontWeight: 700, marginTop: 2 },
  orgAddr: { fontSize: 8.5, color: '#4b5563', marginTop: 2, lineHeight: 1.45 },
  partiesRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  partyCell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingTop: 6,
    paddingRight: 10,
    paddingBottom: 6,
    paddingLeft: 10,
  },
  partyCellBorder: {
    borderRight: '1 solid #9ca3af',
  },
  partyLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#6b7280',
    paddingBottom: 3,
    marginBottom: 4,
    borderBottom: '0.5 solid #9ca3af',
  },
  partyName: { fontSize: 9, fontWeight: 700 },
  partyAddr: { fontSize: 8.5, color: '#4b5563', marginTop: 2, lineHeight: 1.4 },
  partyGstin: { fontSize: 8.3, marginTop: 3 },
  partyGstinLabel: { color: '#6b7280' },
  metaRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1 solid #9ca3af',
    flexGrow: 1,
  },
  metaRowLast: { borderBottom: '0 solid transparent' },
  metaLabel: {
    width: '34%',
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingTop: 6,
    paddingRight: 7,
    paddingBottom: 6,
    paddingLeft: 7,
    borderRight: '1 solid #9ca3af',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  metaValue: {
    width: '66%',
    fontSize: 9,
    fontWeight: 600,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 8,
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  itemsWrap: { flexGrow: 1 },
  table: {
    width: '100%',
    borderBottom: '1 solid #9ca3af',
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    borderTop: '1.5 solid #111827',
    borderBottom: '1.5 solid #111827',
  },
  th: {
    paddingTop: 4,
    paddingRight: 6,
    paddingBottom: 4,
    paddingLeft: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    borderRight: '1 solid #9ca3af',
  },
  td: {
    paddingTop: 4,
    paddingRight: 6,
    paddingBottom: 4,
    paddingLeft: 6,
    fontSize: 8.7,
    borderRight: '1 solid #9ca3af',
    borderBottom: '1 solid #9ca3af',
  },
  tdLast: { borderRight: '0 solid transparent' },
  cellCenter: { textAlign: 'center' },
  cellRight: { textAlign: 'right' },
  desc: { fontWeight: 600 },
  footerWrap: {
    marginTop: 'auto',
    borderTop: '1.5 solid #111827',
  },
  totalsOuter: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderBottom: '1 solid #9ca3af',
  },
  totalsInner: {
    width: 230,
    borderLeft: '1 solid #9ca3af',
  },
  totalsRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingRight: 8,
    paddingBottom: 4,
    paddingLeft: 8,
    borderBottom: '0.5 solid #d1d5db',
    fontSize: 9,
  },
  totalsNet: {
    borderTop: '1 solid #111827',
    borderBottom: '0 solid transparent',
    fontWeight: 700,
  },
  wordsRow: {
    paddingTop: 5,
    paddingRight: 8,
    paddingBottom: 5,
    paddingLeft: 8,
    fontSize: 8.5,
    color: '#6b7280',
    borderLeft: '1 solid #9ca3af',
    borderRight: '1 solid #9ca3af',
    borderBottom: '1 solid #9ca3af',
  },
  wordsStrong: { fontWeight: 700, color: '#111827' },
  bottomRow: {
    display: 'flex',
    flexDirection: 'row',
    borderLeft: '1 solid #9ca3af',
    borderRight: '1 solid #9ca3af',
    borderBottom: '1 solid #9ca3af',
  },
  bottomCell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    fontSize: 8.5,
  },
  bottomCellBorder: { borderRight: '1 solid #9ca3af' },
  cellLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: '#6b7280',
    marginBottom: 5,
  },
  bankRow: { display: 'flex', flexDirection: 'row', gap: 6, marginBottom: 3 },
  bankKey: { width: 48, color: '#6b7280' },
  bankVal: { fontWeight: 600 },
  signArea: { height: 34, borderBottom: '0.5 solid #9ca3af', marginBottom: 4 },
  signLabel: { textAlign: 'center', color: '#6b7280' },
});

function buildVisibleColumns(cols: GridMinimalColumns) {
  const columns: Array<{ key: string; width: number; align?: 'left' | 'center' | 'right' }> = [];

  columns.push({ key: 'sno', width: 26, align: 'center' });
  if (cols.hsn) columns.push({ key: 'hsn', width: 50, align: 'left' });
  columns.push({ key: 'description', width: 999, align: 'left' });
  if (cols.make) columns.push({ key: 'make', width: 56, align: 'left' });
  columns.push({ key: 'qty', width: 36, align: 'right' });
  if (cols.unit) columns.push({ key: 'unit', width: 34, align: 'left' });
  columns.push({ key: 'rate', width: 64, align: 'right' });
  if (cols.discPct) columns.push({ key: 'discPct', width: 40, align: 'right' });
  if (cols.gst) columns.push({ key: 'gst', width: 40, align: 'right' });
  columns.push({ key: 'amount', width: 74, align: 'right' });

  return columns;
}

function getCellText(item: GridMinimalItem, key: string): string {
  switch (key) {
    case 'sno':
      return String(item.sno);
    case 'hsn':
      return item.hsn || '';
    case 'description':
      return item.description;
    case 'make':
      return item.make || '�';
    case 'qty':
      return fmt(item.qty, 0);
    case 'unit':
      return item.unit || '';
    case 'rate':
      return fmt(item.rate);
    case 'discPct':
      return item.discPct && item.discPct > 0 ? `${fmt(item.discPct, 2)}%` : '�';
    case 'gst':
      return item.gstPct !== undefined ? `${fmt(item.gstPct, 2)}%` : '�';
    case 'amount':
      return fmt(item.amount);
    default:
      return '';
  }
}

function alignStyle(align?: 'left' | 'center' | 'right') {
  if (align === 'center') return styles.cellCenter;
  if (align === 'right') return styles.cellRight;
  return undefined;
}

export function GridMinimalDocument({ vm, columns }: { vm: GridMinimalVM; columns: GridMinimalColumns }) {
  const visibleColumns = buildVisibleColumns(columns);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{vm.title}</Text>

        <View style={styles.contentWrapper}>
          <View style={styles.headerOuter}>
          <View style={styles.headerLeft}>
            <View style={styles.orgBlock}>
              <View style={styles.logoBox}>
                {vm.org.logoUrl ? <Image style={styles.logo} src={vm.org.logoUrl} /> : <Text>LOGO</Text>}
              </View>
              <View style={{ flexGrow: 1 }}>
                <Text style={styles.orgName}>{vm.org.name}</Text>
                {vm.org.gstin ? <Text style={styles.orgGstin}>GSTIN: {vm.org.gstin}</Text> : null}
                {vm.org.address ? <Text style={styles.orgAddr}>{vm.org.address}</Text> : null}
              </View>
            </View>

            <View style={styles.partiesRow}>
              {vm.parties.map((party, index) => (
                <View
                  key={party.label}
                  style={[
                    styles.partyCell,
                    index === 0 && vm.parties.length > 1 ? styles.partyCellBorder : undefined,
                  ]}
                >
                  <Text style={styles.partyLabel}>{party.label}</Text>
                  <Text style={styles.partyName}>{party.name}</Text>
                  <Text style={styles.partyAddr}>{party.address}</Text>
                  {party.gstin ? (
                    <Text style={styles.partyGstin}>
                      <Text style={styles.partyGstinLabel}>GSTIN: </Text>
                      {party.gstin}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.headerRight}>
            {vm.meta.map((row, idx) => (
              <View
                key={`${row.label}-${idx}`}
                style={[styles.metaRow, idx === vm.meta.length - 1 ? styles.metaRowLast : undefined]}
              >
                <Text style={styles.metaLabel}>{row.label}</Text>
                <Text style={styles.metaValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.itemsWrap}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {visibleColumns.map((column, idx) => (
                <Text
                  key={column.key}
                  style={[
                    styles.th,
                    alignStyle(column.align),
                    idx === visibleColumns.length - 1 ? styles.tdLast : undefined,
                    { width: column.width === 999 ? undefined : column.width, flexGrow: column.width === 999 ? 1 : 0, flexBasis: column.width === 999 ? 0 : undefined },
                  ]}
                >
                  {column.key === 'sno'
                    ? 'S.No'
                    : column.key === 'hsn'
                      ? 'HSN/SAC'
                      : column.key === 'description'
                        ? 'Item Description'
                        : column.key === 'make'
                          ? 'Make'
                          : column.key === 'qty'
                            ? 'Qty'
                            : column.key === 'unit'
                              ? 'Unit'
                              : column.key === 'rate'
                                ? 'Rate'
                                : column.key === 'discPct'
                                  ? 'Disc%'
                                  : column.key === 'gst'
                                    ? 'GST%'
                                    : 'Amount'}
                </Text>
              ))}
            </View>

            {vm.items.map((item) => (
              <View key={item.id} style={{ display: 'flex', flexDirection: 'row' }}>
                {visibleColumns.map((column, idx) => (
                  <Text
                    key={`${item.id}-${column.key}`}
                    style={[
                      styles.td,
                      alignStyle(column.align),
                      idx === visibleColumns.length - 1 ? styles.tdLast : undefined,
                      column.key === 'description' ? styles.desc : undefined,
                      { width: column.width === 999 ? undefined : column.width, flexGrow: column.width === 999 ? 1 : 0, flexBasis: column.width === 999 ? 0 : undefined },
                    ]}
                  >
                    {getCellText(item, column.key)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footerWrap}>
          <View style={styles.totalsOuter}>
            <View style={styles.totalsInner}>
              <View style={styles.totalsRow}>
                <Text>Sub-total</Text>
                <Text>₹ {fmt(vm.totals.basicAmount)}</Text>
              </View>
              {vm.showTax && vm.totals.sgst !== undefined ? (
                <View style={styles.totalsRow}>
                  <Text>SGST</Text>
                  <Text>₹ {fmt(vm.totals.sgst)}</Text>
                </View>
              ) : null}
              {vm.showTax && vm.totals.cgst !== undefined ? (
                <View style={styles.totalsRow}>
                  <Text>CGST</Text>
                  <Text>₹ {fmt(vm.totals.cgst)}</Text>
                </View>
              ) : null}
              {vm.showTax && vm.totals.igst !== undefined && vm.totals.igst > 0 ? (
                <View style={styles.totalsRow}>
                  <Text>IGST</Text>
                  <Text>₹ {fmt(vm.totals.igst)}</Text>
                </View>
              ) : null}
              {vm.totals.roundOff !== undefined ? (
                <View style={styles.totalsRow}>
                  <Text>Round Off</Text>
                  <Text>
                    {vm.totals.roundOff > 0 ? '+' : ''}₹ {fmt(vm.totals.roundOff)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.totalsRow, styles.totalsNet]}>
                <Text>Net Value</Text>
                <Text>₹ {fmt(vm.totals.netValue)}</Text>
              </View>
            </View>
          </View>

          {vm.totals.amountInWords ? (
            <Text style={styles.wordsRow}>
              <Text style={styles.wordsStrong}>Amount in Words: </Text>
              {vm.totals.amountInWords}
            </Text>
          ) : null}

          <View style={styles.bottomRow}>
            <View style={[styles.bottomCell, styles.bottomCellBorder]}>
              <Text style={styles.cellLabel}>Bank Details</Text>
              {vm.org.bank?.bankName ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankKey}>Bank</Text>
                  <Text style={styles.bankVal}>{vm.org.bank.bankName}</Text>
                </View>
              ) : null}
              {vm.org.bank?.accountNo ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankKey}>A/c No.</Text>
                  <Text style={styles.bankVal}>{vm.org.bank.accountNo}</Text>
                </View>
              ) : null}
              {vm.org.bank?.branch ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankKey}>Branch</Text>
                  <Text style={styles.bankVal}>{vm.org.bank.branch}</Text>
                </View>
              ) : null}
              {vm.org.bank?.ifsc ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankKey}>IFSC</Text>
                  <Text style={styles.bankVal}>{vm.org.bank.ifsc}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.bottomCell}>
              <Text style={styles.cellLabel}>For {vm.org.name}</Text>
              <View style={styles.signArea} />
              <Text style={styles.signLabel}>{vm.authorisedSignLabel || 'Authorised Signatory'}</Text>
            </View>
          </View>
        </View>
        </View>
      </Page>
    </Document>
  );
}
