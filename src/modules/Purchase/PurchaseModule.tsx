import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  styled,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
  NoteAdd as NoteAddIcon,
  AccountBalance as AccountBalanceIcon,
  Payment as PaymentIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../App';
import { Vendors } from './Vendors';
import { PurchaseOrders } from './PurchaseOrders';
import { Bills } from './Bills';
import { DebitNotes } from './DebitNotes';
import { Payments } from './Payments';
import { PaymentQueue } from './PaymentQueue';

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  minHeight: 48,
  fontWeight: 500,
  fontFamily: 'Inter, sans-serif',
  fontSize: '13px',
  '&.Mui-selected': {
    fontWeight: 600,
  },
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  '& .MuiTabs-flexContainer': {
    gap: 4,
  },
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
  },
}));

const ModuleContainer = styled(Box)(({ theme }) => ({
  fontFamily: 'Inter, sans-serif',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.grey[50],
}));

const ContentArea = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: '16px 24px',
});

const Header = styled(Box)(({ theme }) => ({
  padding: '16px 24px',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`purchase-tabpanel-${index}`}
      aria-labelledby={`purchase-tab-${index}`}
      {...other}
      style={{ height: '100%' }}
    >
      {value === index && <Box sx={{ height: '100%' }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `purchase-tab-${index}`,
    'aria-controls': `purchase-tabpanel-${index}`,
  };
}

export const PurchaseModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const { organisation } = useAuth();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabs = [
    { label: 'Vendors', icon: <BusinessIcon fontSize="small" />, component: Vendors },
    { label: 'Purchase Orders', icon: <ShoppingCartIcon fontSize="small" />, component: PurchaseOrders },
    { label: 'Bills', icon: <ReceiptIcon fontSize="small" />, component: Bills },
    { label: 'Debit Notes', icon: <NoteAddIcon fontSize="small" />, component: DebitNotes },
    { label: 'Payments', icon: <AccountBalanceIcon fontSize="small" />, component: Payments },
    { label: 'Payment Queue', icon: <ScheduleIcon fontSize="small" />, component: PaymentQueue },
  ];

  return (
    <ModuleContainer>
      <Header>
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '20px',
              color: 'text.primary',
            }}
          >
            Purchase Management
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              color: 'text.secondary',
              mt: 0.5,
            }}
          >
            {organisation?.name || 'No organization selected'}
          </Typography>
        </Box>
      </Header>

      <Paper elevation={0} sx={{ borderRadius: 0 }}>
        <StyledTabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {tabs.map((tab, index) => (
            <StyledTab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              {...a11yProps(index)}
              sx={{
                '& .MuiTab-iconWrapper': {
                  mr: 1,
                },
              }}
            />
          ))}
        </StyledTabs>
      </Paper>

      <ContentArea>
        <TabPanel value={activeTab} index={0}>
          <Vendors />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <PurchaseOrders />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <Bills />
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          <DebitNotes />
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          <Payments />
        </TabPanel>
        <TabPanel value={activeTab} index={5}>
          <PaymentQueue />
        </TabPanel>
      </ContentArea>
    </ModuleContainer>
  );
};

export default PurchaseModule;