import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useVendorLedger } from '../hooks/usePurchaseQueries';
import {
  buildVendorLedgerEntries,
  calculateVendorLedgerRangeSummary,
  downloadVendorLedgerPdf,
  filterVendorLedgerEntries,
  formatLedgerCurrency,
  formatLedgerDate,
  type VendorLedgerVendor,
} from '../utils/vendorLedger';

type VendorLedgerDialogProps = {
  open: boolean;
  onClose: () => void;
  organisationName: string;
  organisationId?: string;
  vendor: VendorLedgerVendor | null;
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Paper
    elevation={0}
    sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      p: 1.5,
      minWidth: 140,
      backgroundColor: '#fff',
    }}
  >
    <Typography sx={{ fontSize: '11px', color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
      {label}
    </Typography>
    <Typography sx={{ mt: 0.5, fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
      {value}
    </Typography>
  </Paper>
);

export default function VendorLedgerDialog({
  open,
  onClose,
  organisationName,
  organisationId,
  vendor,
}: VendorLedgerDialogProps) {
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const { data, isLoading } = useVendorLedger(organisationId, vendor?.id, open && !!vendor?.id);

  useEffect(() => {
    if (!open) return;
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  }, [open, vendor?.id]);

  const allEntries = useMemo(
    () => buildVendorLedgerEntries(vendor, data?.bills ?? [], data?.payments ?? [], data?.debitNotes ?? []),
    [vendor, data]
  );

  const entries = useMemo(
    () => filterVendorLedgerEntries(allEntries, { startDate: appliedStartDate, endDate: appliedEndDate }),
    [allEntries, appliedStartDate, appliedEndDate]
  );

  const summary = useMemo(
    () => calculateVendorLedgerRangeSummary(entries),
    [entries]
  );
  const hasActivityEntries = entries.some((entry) => entry.type !== 'Opening Balance');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ px: 3, py: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              Vendor Ledger
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: '12px', color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
              {vendor?.company_name || 'Select a vendor'} • {vendor?.vendor_code || '-'}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => vendor && downloadVendorLedgerPdf(organisationName, vendor, summary, entries)}
            disabled={!vendor}
            sx={{ textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}
          >
            Export PDF
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 2 }}>
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.5,
            backgroundColor: 'grey.50',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-end' }}>
            <TextField
              type="date"
              label="From"
              size="small"
              value={draftStartDate}
              onChange={(event) => setDraftStartDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 170 }}
            />
            <TextField
              type="date"
              label="To"
              size="small"
              value={draftEndDate}
              onChange={(event) => setDraftEndDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 170 }}
            />
            <Button
              variant="contained"
              onClick={() => {
                setAppliedStartDate(draftStartDate);
                setAppliedEndDate(draftEndDate);
              }}
              sx={{ textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px', minWidth: 110 }}
            >
              Submit
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setDraftStartDate('');
                setDraftEndDate('');
                setAppliedStartDate('');
                setAppliedEndDate('');
              }}
              sx={{ textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}
            >
              Reset
            </Button>
            {(appliedStartDate || appliedEndDate) ? (
              <Typography sx={{ fontSize: '12px', color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
                Showing ledger activity for the selected date range.
              </Typography>
            ) : null}
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
          <StatCard label="Opening Balance" value={formatLedgerCurrency(summary.openingBalance)} />
          <StatCard label="Bills" value={formatLedgerCurrency(summary.totalBills)} />
          <StatCard label="Payments" value={formatLedgerCurrency(summary.totalPayments)} />
          <StatCard label="Debit Notes" value={formatLedgerCurrency(summary.totalDebitNotes)} />
          <StatCard label="Closing Balance" value={formatLedgerCurrency(summary.closingBalance)} />
        </Box>

        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '110px 90px 120px minmax(220px, 1fr) 110px 110px 120px',
              gap: 0,
              backgroundColor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {['Date', 'Type', 'Reference', 'Remarks', 'Debit', 'Credit', 'Balance'].map((label) => (
              <Typography
                key={label}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </Typography>
            ))}
          </Box>

          <Box sx={{ maxHeight: 460, overflow: 'auto' }}>
            {isLoading ? (
              <Box sx={{ p: 3 }}>
                <Typography sx={{ fontSize: '12px', color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
                  Loading ledger entries...
                </Typography>
              </Box>
            ) : !hasActivityEntries ? (
              <Box sx={{ p: 3 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                  No ledger entries found
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: '12px', color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
                  Bills, payments, and approved debit notes for this vendor will appear here.
                </Typography>
              </Box>
            ) : (
              entries.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '110px 90px 120px minmax(220px, 1fr) 110px 110px 120px',
                      alignItems: 'center',
                    }}
                  >
                    <Typography sx={{ px: 1.5, py: 1.25, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                      {entry.type === 'Opening Balance' ? '-' : formatLedgerDate(entry.date)}
                    </Typography>
                    <Box sx={{ px: 1.5, py: 1.25 }}>
                      <Chip
                        size="small"
                        label={entry.type}
                        color={entry.type === 'Bill' ? 'warning' : entry.type === 'Opening Balance' ? 'default' : 'success'}
                        variant={entry.type === 'Opening Balance' ? 'outlined' : 'filled'}
                        sx={{ height: 22, fontSize: '10px', fontFamily: 'Inter, sans-serif' }}
                      />
                    </Box>
                    <Typography sx={{ px: 1.5, py: 1.25, fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                      {entry.reference}
                    </Typography>
                    <Typography sx={{ px: 1.5, py: 1.25, fontSize: '12px', color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
                      {entry.remarks}
                    </Typography>
                    <Typography sx={{ px: 1.5, py: 1.25, fontSize: '12px', textAlign: 'right', fontFamily: 'Inter, sans-serif' }}>
                      {entry.debit ? formatLedgerCurrency(entry.debit) : '-'}
                    </Typography>
                    <Typography sx={{ px: 1.5, py: 1.25, fontSize: '12px', textAlign: 'right', fontFamily: 'Inter, sans-serif' }}>
                      {entry.credit ? formatLedgerCurrency(entry.credit) : '-'}
                    </Typography>
                    <Typography
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        fontSize: '12px',
                        fontWeight: 700,
                        textAlign: 'right',
                        color: entry.balance > 0 ? 'warning.dark' : 'success.dark',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {formatLedgerCurrency(entry.balance)}
                    </Typography>
                  </Box>
                  {index < entries.length - 1 ? <Divider /> : null}
                </React.Fragment>
              ))
            )}
          </Box>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
