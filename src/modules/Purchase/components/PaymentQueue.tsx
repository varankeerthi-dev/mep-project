import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Chip, IconButton, Tooltip, Tabs, Tab,
  Badge, Alert, LinearProgress,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Schedule as ScheduleIcon, Warning as WarningIcon, AccessTime as AccessTimeIcon,
  Payment as PaymentIcon, CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseBills, usePaymentRequests } from '../hooks/usePurchaseQueries';

export const PaymentQueue: React.FC = () => {
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: bills = [] } = usePurchaseBills(organisation?.id, { overdue: activeTab === 0 });
  const { data: requests = [] } = usePaymentRequests(organisation?.id);

  // Filter bills based on tab
  const filteredBills = bills.filter((bill: any) => {
    if (activeTab === 0) return true; // All
    if (activeTab === 1) { // Overdue
      const dueDate = new Date(bill.due_date);
      return dueDate < new Date() && bill.payment_status !== 'Paid';
    }
    if (activeTab === 2) { // Next 7 Days
      const dueDate = new Date(bill.due_date);
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      return dueDate <= sevenDays && dueDate >= new Date() && bill.payment_status !== 'Paid';
    }
    if (activeTab === 3) { // Next 30 Days
      const dueDate = new Date(bill.due_date);
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      return dueDate <= thirtyDays && dueDate >= new Date() && bill.payment_status !== 'Paid';
    }
    return true;
  });

  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const columns: GridColDef[] = [
    { field: 'bill_number', headerName: 'Bill #', width: 110, renderCell: (p) => <Typography fontWeight="600">{p.value}</Typography> },
    { field: 'bill_date', headerName: 'Bill Date', width: 100, renderCell: (p) => <Typography>{new Date(p.value).toLocaleDateString('en-IN')}</Typography> },
    { field: 'due_date', headerName: 'Due Date', width: 100, renderCell: (p: GridRenderCellParams) => {
      const daysOverdue = calculateDaysOverdue(p.value);
      return (
        <Box>
          <Typography>{new Date(p.value).toLocaleDateString('en-IN')}</Typography>
          {daysOverdue > 0 && <Typography variant="caption" color="error" fontWeight="600">{daysOverdue} days overdue</Typography>}
        </Box>
      );
    }},
    { field: 'vendor', headerName: 'Vendor', width: 180, renderCell: (p) => <Typography>{p.value?.company_name}</Typography> },
    { field: 'total_amount', headerName: 'Total', width: 110, renderCell: (p) => <Typography align="right">₹{Number(p.value).toLocaleString()}</Typography> },
    { field: 'paid_amount', headerName: 'Paid', width: 100, renderCell: (p) => <Typography align="right" color="success.main">₹{Number(p.value).toLocaleString()}</Typography> },
    { field: 'balance_amount', headerName: 'Balance', width: 110, renderCell: (p) => <Typography align="right" fontWeight="600" color="error">₹{Number(p.value).toLocaleString()}</Typography> },
    { field: 'payment_status', headerName: 'Status', width: 120, renderCell: (p) => (
      <Chip label={p.value} size="small" color={p.value === 'Paid' ? 'success' : p.value === 'Partially Paid' ? 'warning' : 'error'} />
    )},
    { field: 'days_left', headerName: 'Priority', width: 100, sortable: false, renderCell: (p: GridRenderCellParams) => {
      const days = calculateDaysOverdue(p.row.due_date);
      if (days > 0) return <Chip icon={<WarningIcon />} label={`${days}d`} size="small" color="error" />;
      const due = new Date(p.row.due_date);
      const today = new Date();
      const left = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return left <= 7 ? <Chip label={`${left}d`} size="small" color="warning" /> : <Chip label={`${left}d`} size="small" />;
    }},
    { field: 'actions', headerName: 'Action', width: 130, sortable: false, renderCell: () => (
      <Button size="small" variant="contained" color="success" startIcon={<PaymentIcon />}>Pay</Button>
    )},
  ];

  // Calculate summary
  const totalPayable = filteredBills.reduce((sum: number, b: any) => sum + (b.balance_amount || 0), 0);
  const overdueAmount = filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0).reduce((sum: number, b: any) => sum + (b.balance_amount || 0), 0);
  const criticalCount = filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0 || (new Date(b.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7).length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 2 }}>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" fontFamily="Inter">Total Payable</Typography>
          <Typography variant="h5" fontWeight="700" fontFamily="Inter" color="error">₹{totalPayable.toLocaleString()}</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" fontFamily="Inter">Overdue</Typography>
          <Typography variant="h5" fontWeight="700" fontFamily="Inter" color="error">₹{overdueAmount.toLocaleString()}</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" fontFamily="Inter">Critical (≤7 days)</Typography>
          <Typography variant="h5" fontWeight="700" fontFamily="Inter" color="warning.main">{criticalCount} bills</Typography>
        </Paper>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" fontFamily="Inter">Pending Requests</Typography>
          <Typography variant="h5" fontWeight="700" fontFamily="Inter">{requests.filter((r: any) => r.status === 'Pending').length}</Typography>
        </Paper>
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden', flex: 1 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label={<Badge badgeContent={filteredBills.length} color="primary">All Pending</Badge>} />
            <Tab label={<Badge badgeContent={filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0).length} color="error">Overdue</Badge>} />
            <Tab label={<Badge badgeContent={filteredBills.filter((b: any) => { const d = new Date(b.due_date); const t = new Date(); const s = new Date(); s.setDate(t.getDate() + 7); return d <= s && d >= t; }).length} color="warning">Next 7 Days</Badge>} />
            <Tab label={<Badge badgeContent={filteredBills.filter((b: any) => { const d = new Date(b.due_date); const t = new Date(); const s = new Date(); s.setDate(t.getDate() + 30); return d <= s && d >= t; }).length} color="info">Next 30 Days</Badge>} />
          </Tabs>
          <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ width: 250 }} />
        </Box>

        {overdueAmount > 0 && activeTab === 1 && (
          <Alert severity="error" sx={{ mx: 2, mt: 2 }} icon={<WarningIcon />}>
            <Typography fontFamily="Inter" fontWeight={600}>₹{overdueAmount.toLocaleString()} is overdue!</Typography>
          </Alert>
        )}

        <DataGrid
          rows={filteredBills}
          columns={columns}
          density="compact"
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          sx={{
            fontFamily: 'Inter, sans-serif',
            '& .MuiDataGrid-cell': { fontSize: '13px' },
            '& .MuiDataGrid-columnHeader': { fontSize: '12px', fontWeight: 600, backgroundColor: 'grey.50' },
            border: 'none',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Paper>
    </Box>
  );
};

export default PaymentQueue;