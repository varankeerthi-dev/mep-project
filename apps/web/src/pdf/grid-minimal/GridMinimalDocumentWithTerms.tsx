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
  is_header?: boolean;
};

export type GridMinimalTotals = {
  basicAmount: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  roundOff: number;
  netValue: number;
  amountInWords: string;
};

export type GridMinimalViewModel = {
  title: string;
  org: GridMinimalOrg;
  parties: GridMinimalParty[];
  meta: GridMinimalMetaRow[];
  items: GridMinimalItem[];
  totals: GridMinimalTotals;
  showTax: boolean;
  authorisedSignLabel: string;
  termsConditions?: string;
};

export interface GridMinimalDocumentProps {
  vm: GridMinimalViewModel;
  columns: GridMinimalColumns;
}

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n);

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  partiesRow: {
    display: 'flex',
    marginBottom: 12,
  },
  partyCell: {
    flex: 1,
    border: '1 solid #000',
    padding: 4,
  },
  partyLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  partyName: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  partyAddress: {
    fontSize: 8,
    marginBottom: 2,
  },
  metaRow: {
    display: 'flex',
    marginBottom: 8,
  },
  metaCell: {
    flex: 1,
    fontSize: 8,
    padding: '2 4',
    border: '1 solid #000',
    textAlign: 'center',
  },
  tableHeader: {
    display: 'flex',
    marginBottom: 4,
    backgroundColor: '#f5f5f5',
    borderBottom: '1 solid #000',
  },
  tableRow: {
    display: 'flex',
    borderBottom: '1 solid #e0e0e0',
    minHeight: 16,
  },
  cell: {
    padding: '2 4',
    fontSize: 8,
    borderRight: '1 solid #e0e0e0',
    textAlign: 'left',
  },
  cellRight: {
    padding: '2 4',
    fontSize: 8,
    borderRight: '1 solid #e0e0e0',
    textAlign: 'right',
  },
  cellCenter: {
    padding: '2 4',
    fontSize: 8,
    borderRight: '1 solid #e0e0e0',
    textAlign: 'center',
  },
  totalsRow: {
    display: 'flex',
    marginBottom: 4,
  },
  totalsCell: {
    flex: 1,
    padding: '2 4',
    fontSize: 8,
    border: '1 solid #000',
    textAlign: 'right',
  },
  totalsLabel: {
    flex: 3,
    padding: '2 4',
    fontSize: 8,
    fontWeight: 'bold',
    border: '1 solid #000',
  },
  wordsRow: {
    fontSize: 8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  wordsStrong: {
    fontWeight: 'bold',
  },
  bottomRow: {
    display: 'flex',
    marginTop: 20,
  },
  bottomCell: {
    flex: 1,
    border: '1 solid #000',
    padding: 8,
  },
  bottomCellBorder: {
    borderRight: '1 solid #000',
  },
  cellLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bankRow: {
    display: 'flex',
    marginBottom: 2,
  },
  bankKey: {
    flex: 1,
    fontSize: 7,
  },
  bankVal: {
    flex: 2,
    fontSize: 7,
    fontWeight: 'bold',
  },
  signArea: {
    height: 20,
    borderBottom: '1 solid #000',
    marginBottom: 4,
  },
  signLabel: {
    fontSize: 7,
    textAlign: 'center',
  },
  termsSection: {
    marginTop: 16,
    padding: 8,
    border: '1 solid #000',
  },
  termsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  termsContent: {
    fontSize: 7,
    lineHeight: 1.2,
    whiteSpace: 'pre-wrap',
  },
});

export function GridMinimalDocumentWithTerms({ vm, columns }: GridMinimalDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{vm.title}</Text>
          
          {/* Parties */}
          <View style={styles.partiesRow}>
            {vm.parties.map((party, idx) => (
              <View key={idx} style={styles.partyCell}>
                <Text style={styles.partyLabel}>{party.label}</Text>
                <Text style={styles.partyName}>{party.name}</Text>
                <Text style={styles.partyAddress}>{party.address}</Text>
                {party.gstin && <Text style={styles.partyAddress}>GSTIN: {party.gstin}</Text>}
              </View>
            ))}
          </View>

          {/* Meta Information */}
          <View style={styles.metaRow}>
            {vm.meta.map((meta, idx) => (
              <View key={idx} style={styles.metaCell}>
                <Text>{meta.label}</Text>
                <Text style={{ fontWeight: 'bold' }}>{meta.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.tableHeader}>
          {columns.sno !== false && <Text style={[styles.cell, { flex: 0.5 }]}>S.No</Text>}
          {columns.hsn && <Text style={[styles.cell, { flex: 1 }]}>HSN/SAC</Text>}
          <Text style={[styles.cell, { flex: 3 }]}>Description</Text>
          {columns.make && <Text style={[styles.cell, { flex: 1 }]}>Make</Text>}
          {columns.unit && <Text style={[styles.cellCenter, { flex: 0.5 }]}>Unit</Text>}
          <Text style={[styles.cellCenter, { flex: 0.5 }]}>Qty</Text>
          {columns.discPct && <Text style={[styles.cellRight, { flex: 0.5 }]}>Disc%</Text>}
          {columns.gst && <Text style={[styles.cellRight, { flex: 0.5 }]}>GST%</Text>}
          <Text style={[styles.cellRight, { flex: 1 }]}>Rate</Text>
          <Text style={[styles.cellRight, { flex: 1.2, borderRight: 'none' }]}>Amount</Text>
        </View>

        {vm.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            {columns.sno !== false && <Text style={[styles.cell, { flex: 0.5 }]}>{item.sno}</Text>}
            {columns.hsn && <Text style={[styles.cell, { flex: 1 }]}>{item.hsn}</Text>}
            <Text style={[styles.cell, { flex: 3 }]}>{item.description}</Text>
            {columns.make && <Text style={[styles.cell, { flex: 1 }]}>{item.make}</Text>}
            {columns.unit && <Text style={[styles.cellCenter, { flex: 0.5 }]}>{item.unit}</Text>}
            <Text style={[styles.cellCenter, { flex: 0.5 }]}>{item.qty}</Text>
            {columns.discPct && <Text style={[styles.cellRight, { flex: 0.5 }]}>{item.discPct}%</Text>}
            {columns.gst && <Text style={[styles.cellRight, { flex: 0.5 }]}>{item.gstPct}%</Text>}
            <Text style={[styles.cellRight, { flex: 1 }]}>{fmt(item.rate)}</Text>
            <Text style={[styles.cellRight, { flex: 1.2, borderRight: 'none' }]}>{fmt(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalsLabel}>
            <Text>Basic Amount</Text>
          </View>
          <View style={styles.totalsCell}>
            <Text>₹{fmt(vm.totals.basicAmount)}</Text>
          </View>
        </View>

        {vm.showTax && vm.totals.sgst !== undefined && (
          <View style={styles.totalsRow}>
            <View style={styles.totalsLabel}>
              <Text>SGST</Text>
            </View>
            <View style={styles.totalsCell}>
              <Text>₹{fmt(vm.totals.sgst)}</Text>
            </View>
          </View>
        )}

        {vm.showTax && vm.totals.cgst !== undefined && (
          <View style={styles.totalsRow}>
            <View style={styles.totalsLabel}>
              <Text>CGST</Text>
            </View>
            <View style={styles.totalsCell}>
              <Text>₹{fmt(vm.totals.cgst)}</Text>
            </View>
          </View>
        )}

        {vm.showTax && vm.totals.igst !== undefined && (
          <View style={styles.totalsRow}>
            <View style={styles.totalsLabel}>
              <Text>IGST</Text>
            </View>
            <View style={styles.totalsCell}>
              <Text>₹{fmt(vm.totals.igst)}</Text>
            </View>
          </View>
        )}

        <View style={styles.totalsRow}>
          <View style={styles.totalsLabel}>
            <Text>Round Off</Text>
          </View>
          <View style={styles.totalsCell}>
            <Text>₹{fmt(vm.totals.roundOff)}</Text>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalsLabel}>
            <Text>Net Value</Text>
          </View>
          <View style={styles.totalsCell}>
            <Text>₹{fmt(vm.totals.netValue)}</Text>
          </View>
        </View>

        {vm.totals.amountInWords ? (
          <Text style={styles.wordsRow}>
            <Text style={styles.wordsStrong}>Amount in Words: </Text>
            {vm.totals.amountInWords}
          </Text>
        ) : null}

        {/* Terms & Conditions */}
        {vm.termsConditions && (
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>Terms & Conditions</Text>
            <Text style={styles.termsContent}>{vm.termsConditions}</Text>
          </View>
        )}

        {/* Bottom Row */}
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
      </Page>
    </Document>
  );
}
