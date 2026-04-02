import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Chip, IconButton, Tooltip, Autocomplete,
  Stepper, Step, StepLabel, FormControlLabel,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon, Edit as EditIcon, AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { usePayments, useVendors, usePurchaseBills, useCreatePayment } from '../hooks/usePurchaseQueries';

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Card', 'NEFT', 'RTGS'];

export const Payments: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [selectedBills, setSelectedBills] = useState<any[]>([]);
  const [isAdvance, setIsAdvance] = useState(false);

  const { data: payments = [], isLoading } = usePayments(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const { data: bills = [] } = usePurchaseBills(organisation?.id, { status: 'Unpaid' });
  const createPayment = useCreatePayment();

  const handleAddPayment = () => {
    setOpenDialog(true);
    setActiveStep(0);
    setVendorId('');
    setAmount('');
    setSelectedBills([]);
    setIsAdvance(false);
  };

  const handleCreateRequest = () => {
    setOpenRequestDialog(true);
  };

  const handleSave = async () => {
    const paymentData = {
      organisation_id: organisation?.id,
      vendor_id: vendorId,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      amount: Number(amount),
      reference_no: referenceNo,
      narration,
      is_advance: isAdvance,
    };

    const billAllocations = selectedBills.map((bill: any) => ({
      bill_id: bill.id,
      adjusted_amount: bill.adjusted_amount,
      tds_amount: bill.tds_amount || 0,
    }));

    await createPayment.mutateAsync({ paymentData, billAllocations });
    setOpenDialog(false);
  };

  const columns: GridColDef[] = [
    { field: 'voucher_no', headerName: 'Voucher #', width: 120, renderCell: (p) => <Typography fontWeight="600" color="success.main">{p.value}</Typography> },
    { field: 'payment_date', headerName: 'Date', width: 100, renderCell: (p) => <Typography>{new Date(p.value).toLocaleDateString('en-IN')}</Typography> },
    { field: 'vendor', headerName: 'Vendor', width: 180, renderCell: (p) => <Typography>{p.value?.company_name}</Typography> },
    { field: 'payment_mode', headerName: 'Mode', width: 110, renderCell: (p) => <Chip label={p.value} size="small" variant="outlined" /> },
    { field: 'amount', headerName: 'Amount', width: 130, renderCell: (p) => <Typography align="right" fontWeight="500" color="success.main">₹{Number(p.value).toLocaleString()}</Typography> },
    { field: 'reference_no', headerName: 'Reference', width: 130 },
    { field: 'is_advance', headerName: 'Type', width: 100, renderCell: (p) => p.value ? <Chip label="Advance" size="small" color="warning" /> : <Chip label="Against Bill" size="small" /> },
    { field: 'actions', headerName: 'Actions', width: 100, sortable: false, renderCell: () => (
      <Box><IconButton size="small"><PdfIcon fontSize="small" color="error" /></IconButton></Box>
    )},
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceIcon color="success" />
            <Typography variant="h6" fontFamily="Inter" fontWeight={600}>Payments Made</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreateRequest}>Payment Request</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddPayment} color="success">Record Payment</Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <DataGrid rows={payments} columns={columns} loading={isLoading} density="compact" disableRowSelectionOnClick
          sx={{ fontFamily: 'Inter, sans-serif', '& .MuiDataGrid-cell': { fontSize: '13px' }, '& .MuiDataGrid-columnHeader': { fontSize: '12px', fontWeight: 600, backgroundColor: 'grey.50' } }}
          pageSizeOptions={[25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600 }}>Record Payment</DialogTitle>
        <DialogContent sx={{ minHeight: 400 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            <Step><StepLabel>Select Vendor</StepLabel></Step>
            <Step><StepLabel>Payment Details</StepLabel></Step>
            <Step><StepLabel>Allocate to Bills</StepLabel></Step>
          </Stepper>

          {activeStep === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Autocomplete options={vendors} getOptionLabel={(o: any) => o.company_name} onChange={(e, v) => setVendorId(v?.id || '')}
                  renderInput={(p) => <TextField {...p} label="Select Vendor *" size="small" fullWidth />} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<input type="checkbox" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />} label="Advance Payment (Without Bill)" />
              </Grid>
            </Grid>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><TextField fullWidth type="date" label="Payment Date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small"><InputLabel>Payment Mode</InputLabel><Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} label="Payment Mode">
                  {PAYMENT_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select></FormControl>
              </Grid>
              <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Amount *" value={amount} onChange={(e) => setAmount(e.target.value)} size="small" /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="Reference No / Cheque No" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} size="small" /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="Bank Account" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} size="small" /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} size="small" /></Grid>
            </Grid>
          )}

          {activeStep === 2 && !isAdvance && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Select Bills to Pay:</Typography>
              <DataGrid rows={bills.filter((b: any) => b.vendor_id === vendorId)} columns={[
                { field: 'bill_number', headerName: 'Bill #', width: 110 },
                { field: 'bill_date', headerName: 'Date', width: 100 },
                { field: 'total_amount', headerName: 'Amount', width: 110, renderCell: (p) => <Typography align="right">₹{Number(p.value).toLocaleString()}</Typography> },
                { field: 'balance_amount', headerName: 'Balance', width: 110, renderCell: (p) => <Typography align="right" color="error">₹{Number(p.value).toLocaleString()}</Typography> },
              ]} density="compact" checkboxSelection hideFooterPagination sx={{ height: 300 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          {activeStep > 0 && <Button onClick={() => setActiveStep(activeStep - 1)}>Back</Button>}
          {activeStep < 2 ? (
            <Button variant="contained" onClick={() => setActiveStep(activeStep + 1)} disabled={activeStep === 0 && !vendorId}>Next</Button>
          ) : (
            <Button variant="contained" color="success" onClick={handleSave} disabled={!amount || Number(amount) <= 0}>Save Payment</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Payment Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Autocomplete options={vendors} getOptionLabel={(o: any) => o.company_name}
                renderInput={(p) => <TextField {...p} label="Vendor" size="small" fullWidth />} />
            </Grid>
            <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Amount Requested" size="small" /></Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small"><InputLabel>Priority</InputLabel><Select label="Priority">
                <MenuItem value="Low">Low</MenuItem><MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="High">High</MenuItem><MenuItem value="Urgent">Urgent</MenuItem>
              </Select></FormControl>
            </Grid>
            <Grid item xs={12} md={6}><TextField fullWidth type="date" label="Due Date" size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Reason / Notes" size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenRequestDialog(false)}>Submit Request</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Payments;
