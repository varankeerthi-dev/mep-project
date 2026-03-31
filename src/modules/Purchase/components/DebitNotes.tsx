import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Chip, IconButton, Tooltip, Autocomplete,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, NoteAdd as NoteAddIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDebitNotes, usePurchaseBills, useVendors, useCreateDebitNote } from '../hooks/usePurchaseQueries';

const DN_TYPES = ['Purchase Return', 'Rate Difference', 'Discount', 'Rejection'];
const GST_RATES = [0, 5, 12, 18, 28];

export const DebitNotes: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [billId, setBillId] = useState('');
  const [dnType, setDnType] = useState('Purchase Return');
  const [dnDate, setDnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState({ subtotal: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const { data: dns = [], isLoading } = useDebitNotes(organisation?.id);
  const { data: bills = [] } = usePurchaseBills(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createDN = useCreateDebitNote();

  const handleAdd = () => {
    setOpenDialog(true);
    setBillId('');
    setItems([]);
  };

  const columns: GridColDef[] = [
    { field: 'dn_number', headerName: 'DN #', width: 110, renderCell: (p) => <Typography fontWeight="600" color="error">{p.value}</Typography> },
    { field: 'dn_date', headerName: 'Date', width: 100, renderCell: (p) => <Typography>{new Date(p.value).toLocaleDateString('en-IN')}</Typography> },
    { field: 'bill', headerName: 'Original Bill', width: 130, renderCell: (p) => <Typography>{p.value?.bill_number}</Typography> },
    { field: 'vendor', headerName: 'Vendor', width: 180, renderCell: (p) => <Typography>{p.value?.company_name}</Typography> },
    { field: 'dn_type', headerName: 'Type', width: 140, renderCell: (p) => <Chip label={p.value} size="small" color="warning" /> },
    { field: 'total_amount', headerName: 'Amount', width: 120, renderCell: (p) => <Typography align="right" fontWeight="500" color="error">-₹{Number(p.value).toLocaleString()}</Typography> },
    { field: 'approval_status', headerName: 'Status', width: 120, renderCell: (p) => <Chip label={p.value} size="small" color={p.value === 'Approved' ? 'success' : 'default'} /> },
    { field: 'actions', headerName: 'Actions', width: 100, sortable: false, renderCell: () => (
      <Box><IconButton size="small"><PdfIcon fontSize="small" color="error" /></IconButton></Box>
    )},
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NoteAddIcon color="error" />
            <Typography variant="h6" fontFamily="Inter" fontWeight={600}>Debit Notes</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} color="error">Create DN</Button>
        </Box>
      </Paper>

      <Paper sx={{ flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <DataGrid rows={dns} columns={columns} loading={isLoading} density="compact" disableRowSelectionOnClick
          sx={{ fontFamily: 'Inter, sans-serif', '& .MuiDataGrid-cell': { fontSize: '13px' }, '& .MuiDataGrid-columnHeader': { fontSize: '12px', fontWeight: 600, backgroundColor: 'grey.50' } }}
          pageSizeOptions={[25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600, color: 'error.main' }}>Create Debit Note</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Autocomplete options={bills} getOptionLabel={(o: any) => `${o.bill_number} - ${o.vendor?.company_name}`} onChange={(e, v) => setBillId(v?.id || '')}
                renderInput={(p) => <TextField {...p} label="Select Original Bill *" size="small" fullWidth />} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small"><InputLabel>Type</InputLabel><Select value={dnType} onChange={(e) => setDnType(e.target.value)} label="Type">
                {DN_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select></FormControl>
            </Grid>
            <Grid item xs={12} md={3}><TextField fullWidth type="date" label="DN Date" value={dnDate} onChange={(e) => setDnDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} size="small" placeholder="Reason for debit note..." /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={!billId || !reason}>Create DN</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DebitNotes;