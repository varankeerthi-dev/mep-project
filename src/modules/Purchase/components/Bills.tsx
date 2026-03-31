import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Chip, IconButton, Tooltip, Autocomplete,
  FormControlLabel, Checkbox, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Receipt as ReceiptIcon,
  PictureAsPdf as PdfIcon, Warehouse as WarehouseIcon, LocalShipping as ShippingIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../App';
import { usePurchaseBills, useVendors, useCreatePurchaseBill } from '../hooks/usePurchaseQueries';
import { generateBillPDF, openPDFPreview } from '../utils/pdfGenerator';

const GST_RATES = [0, 5, 12, 18, 28];

interface BillItem {
  id?: string;
  sr: number;
  item_name: string;
  batch_no: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount: number;
  taxable_value: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_amount: number;
  warehouse_id?: string;
  godown_location?: string;
}

export const Bills: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [directSupply, setDirectSupply] = useState(false);
  const [siteAddress, setSiteAddress] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [freightAmount, setFreightAmount] = useState(0);
  const [items, setItems] = useState<BillItem[]>([]);
  const [totals, setTotals] = useState({
    subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0,
    freight: 0, total: 0, totalInr: 0,
  });

  const { data: bills = [], isLoading } = usePurchaseBills(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createBill = useCreatePurchaseBill();

  const handleAdd = () => {
    setOpenDialog(true);
    setVendorId('');
    setItems([]);
    setDirectSupply(false);
  };

  const addItem = () => {
    setItems([...items, {
      sr: items.length + 1, item_name: '', batch_no: '', quantity: 1, unit: 'Nos',
      rate: 0, discount_amount: 0, taxable_value: 0, cgst_percent: 9, cgst_amount: 0,
      sgst_percent: 9, sgst_amount: 0, igst_percent: 18, igst_amount: 0, total_amount: 0,
    }]);
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    const line = updated[index].quantity * updated[index].rate;
    updated[index].taxable_value = line - updated[index].discount_amount;
    updated[index].cgst_amount = (updated[index].taxable_value * updated[index].cgst_percent) / 100;
    updated[index].sgst_amount = (updated[index].taxable_value * updated[index].sgst_percent) / 100;
    updated[index].igst_amount = (updated[index].taxable_value * updated[index].igst_percent) / 100;
    updated[index].total_amount = updated[index].taxable_value + updated[index].cgst_amount + updated[index].sgst_amount;
    setItems(updated);
    calculateTotals(updated);
  };

  const calculateTotals = (currentItems: BillItem[]) => {
    let subtotal = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
    currentItems.forEach(item => {
      subtotal += item.quantity * item.rate;
      taxable += item.taxable_value;
      cgst += item.cgst_amount;
      sgst += item.sgst_amount;
      igst += item.igst_amount;
    });
    const total = taxable + cgst + sgst + igst + freightAmount;
    setTotals({
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: 0, taxable: parseFloat(taxable.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)), sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)), freight: freightAmount,
      total: parseFloat(total.toFixed(2)),
      totalInr: parseFloat((total * exchangeRate).toFixed(2)),
    });
  };

  const handleSave = async () => {
    const billData = {
      organisation_id: organisation?.id,
      bill_number: billNumber,
      vendor_invoice_no: vendorInvoiceNo,
      vendor_id: vendorId,
      bill_date: billDate,
      due_date: dueDate,
      currency,
      exchange_rate: exchangeRate,
      warehouse_id: directSupply ? null : warehouseId,
      direct_supply_to_site: directSupply,
      site_address: directSupply ? siteAddress : null,
      eway_bill_no: ewayBillNo,
      vehicle_no: vehicleNo,
      freight_amount: freightAmount,
      subtotal: totals.subtotal,
      taxable_amount: totals.taxable,
      cgst_amount: totals.cgst,
      sgst_amount: totals.sgst,
      igst_amount: totals.igst,
      total_amount: totals.total,
      total_amount_inr: totals.totalInr,
      net_amount: totals.total,
      payment_status: 'Unpaid',
    };
    await createBill.mutateAsync({ billData, items });
    setOpenDialog(false);
  };

  const columns: GridColDef[] = [
    { field: 'bill_number', headerName: 'Bill #', width: 110, renderCell: (p) => <Typography fontWeight="600" color="primary">{p.value}</Typography> },
    { field: 'bill_date', headerName: 'Date', width: 100, renderCell: (p) => <Typography>{new Date(p.value).toLocaleDateString('en-IN')}</Typography> },
    { field: 'vendor', headerName: 'Vendor', width: 180, renderCell: (p) => <Typography>{p.value?.company_name}</Typography> },
    { field: 'vendor_invoice_no', headerName: 'Vendor Inv#', width: 130 },
    { field: 'total_amount', headerName: 'Amount', width: 130, renderCell: (p) => <Typography align="right" fontWeight="500">₹{Number(p.value).toLocaleString()}</Typography> },
    { field: 'payment_status', headerName: 'Status', width: 120, renderCell: (p) => <Chip label={p.value} size="small" color={p.value === 'Paid' ? 'success' : p.value === 'Partially Paid' ? 'warning' : 'default'} /> },
    { field: 'direct_supply_to_site', headerName: 'Direct', width: 80, renderCell: (p) => p.value ? <ShippingIcon color="primary" fontSize="small" /> : <WarehouseIcon color="action" fontSize="small" /> },
    { field: 'actions', headerName: 'Actions', width: 120, sortable: false, renderCell: (p) => (
      <Box>
        <IconButton size="small" onClick={() => {}}><PdfIcon fontSize="small" color="error" /></IconButton>
        <IconButton size="small" onClick={() => {}}><EditIcon fontSize="small" /></IconButton>
      </Box>
    )},
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="primary" />
            <Typography variant="h6" fontFamily="Inter" fontWeight={600}>Purchase Bills</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ width: 250 }} />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>Enter Bill</Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <DataGrid rows={bills} columns={columns} loading={isLoading} density="compact" disableRowSelectionOnClick
          sx={{ fontFamily: 'Inter, sans-serif', '& .MuiDataGrid-cell': { fontSize: '13px' }, '& .MuiDataGrid-columnHeader': { fontSize: '12px', fontWeight: 600, backgroundColor: 'grey.50' } }}
          pageSizeOptions={[25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600 }}>Enter Purchase Bill</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Autocomplete options={vendors} getOptionLabel={(o) => o.company_name} onChange={(e, v) => setVendorId(v?.id || '')}
                renderInput={(p) => <TextField {...p} label="Vendor *" size="small" fullWidth />} />
            </Grid>
            <Grid item xs={12} md={3}><TextField fullWidth label="Bill Number *" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} size="small" /></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth label="Vendor Inv#" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} size="small" /></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth type="date" label="Bill Date" value={billDate} onChange={(e) => setBillDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} md={3}><TextField fullWidth type="date" label="Due Date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small"><InputLabel>Currency</InputLabel><Select value={currency} onChange={(e) => setCurrency(e.target.value)} label="Currency">
                {['INR', 'USD', 'EUR'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select></FormControl>
            </Grid>
            <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Exchange Rate" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} size="small" disabled={currency === 'INR'} /></Grid>
            
            <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, mb: 1, fontFamily: 'Inter', fontWeight: 600 }}>Warehouse / Storage</Typography></Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} size="small" disabled={directSupply} placeholder="Select warehouse..." />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel control={<Checkbox checked={directSupply} onChange={(e) => setDirectSupply(e.target.checked)} />} label={<Typography fontWeight={500} color={directSupply ? 'primary' : 'inherit'}>Direct Supply to Site (Skip warehouse stock)</Typography>} />
            </Grid>
            {directSupply && (
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label="Site Address" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} size="small" placeholder="Enter project site address where materials are delivered directly..." />
              </Grid>
            )}

            <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, mb: 1, fontFamily: 'Inter', fontWeight: 600 }}>Transport Details (Optional)</Typography></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth label="E-Way Bill No" value={ewayBillNo} onChange={(e) => setEwayBillNo(e.target.value)} size="small" /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth label="Vehicle No" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} size="small" /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Freight Amount" value={freightAmount} onChange={(e) => { setFreightAmount(Number(e.target.value)); calculateTotals(items); }} size="small" /></Grid>

            <Grid item xs={12}><Button variant="outlined" startIcon={<AddIcon />} onClick={addItem} sx={{ mt: 2 }}>Add Item</Button></Grid>
            <Grid item xs={12}>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell width={30}>#</TableCell><TableCell>Item Name</TableCell><TableCell width={80}>Batch</TableCell>
                    <TableCell width={60}>Qty</TableCell><TableCell width={50}>Unit</TableCell><TableCell width={80}>Rate</TableCell>
                    <TableCell width={50}>Disc</TableCell><TableCell width={60}>GST%</TableCell><TableCell width={90} align="right">Amount</TableCell><TableCell width={40}></TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.sr}</TableCell>
                        <TableCell><TextField size="small" fullWidth value={item.item_name} onChange={(e) => updateItem(idx, 'item_name', e.target.value)} placeholder="Item name" /></TableCell>
                        <TableCell><TextField size="small" fullWidth value={item.batch_no} onChange={(e) => updateItem(idx, 'batch_no', e.target.value)} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} /></TableCell>
                        <TableCell><TextField size="small" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.rate} onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.discount_amount} onChange={(e) => updateItem(idx, 'discount_amount', Number(e.target.value))} /></TableCell>
                        <TableCell><FormControl size="small" fullWidth><Select value={item.cgst_percent + item.sgst_percent} onChange={(e) => { const gst = Number(e.target.value); updateItem(idx, 'cgst_percent', gst/2); updateItem(idx, 'sgst_percent', gst/2); updateItem(idx, 'igst_percent', gst); }}>
                          {GST_RATES.map((r) => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
                        </Select></FormControl></TableCell>
                        <TableCell align="right"><Typography fontWeight="500">{item.total_amount.toFixed(2)}</Typography></TableCell>
                        <TableCell><IconButton size="small" color="error" onClick={() => { const updated = items.filter((_, i) => i !== idx); setItems(updated); calculateTotals(updated); }}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Paper sx={{ p: 2, minWidth: 300, border: '1px solid #ddd' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontFamily: 'Inter', fontWeight: 600 }}>Bill Summary</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" fontFamily="Inter">Subtotal:</Typography><Typography variant="body2" fontFamily="Inter" align="right">{totals.subtotal.toFixed(2)}</Typography>
                    <Typography variant="body2" fontFamily="Inter">Freight:</Typography><Typography variant="body2" fontFamily="Inter" align="right">{totals.freight.toFixed(2)}</Typography>
                    <Typography variant="body2" fontFamily="Inter" fontWeight={500}>Taxable Value:</Typography><Typography variant="body2" fontFamily="Inter" align="right" fontWeight={500">{totals.taxable.toFixed(2)}</Typography>
                    <Typography variant="body2" fontFamily="Inter">CGST:</Typography><Typography variant="body2" fontFamily="Inter" align="right">{totals.cgst.toFixed(2)}</Typography>
                    <Typography variant="body2" fontFamily="Inter">SGST:</Typography><Typography variant="body2" fontFamily="Inter" align="right">{totals.sgst.toFixed(2)}</Typography>
                    <Box sx={{ gridColumn: '1 / -1', height: '1px', bgcolor: 'divider', my: 1 }} />
                    <Typography variant="body1" fontFamily="Inter" fontWeight={700}>TOTAL:</Typography>
                    <Typography variant="body1" fontFamily="Inter" align="right" fontWeight={700}>{currency === 'INR' ? '₹' : currency} {totals.total.toFixed(2)}</Typography>
                    {currency !== 'INR' && <Typography variant="caption" fontFamily="Inter" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'right' }}>(₹{totals.totalInr.toFixed(2)})</Typography>}
                  </Box>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={items.length === 0 || !vendorId || !billNumber}>Save Bill</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Bills;