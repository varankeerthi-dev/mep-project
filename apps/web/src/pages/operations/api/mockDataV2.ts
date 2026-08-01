// src/pages/operations/api/mockDataV2.ts

// Enhanced types for Operations V2

export interface NeedsAttentionItemV2 {
  id: string;
  type: 'alert' | 'warn' | 'info';
  tagLabel: string;
  title: string;
  context: string;
  amount: number | null;
  days: number;
  link: string;
  owner?: {
    name: string;
    initials: string;
  };
  statusBadge?: {
    text: string;
    type: 'Today' | 'days' | 'Overdue';
  };
}

export interface LiveNowSiteCheckInV2 {
  id: string;
  time: string;
  engineer: string;
  siteActivity: string;
  status: string;
  statusType: 'verified' | 'uploaded' | 'onsite' | 'checkedin';
}

export interface LiveNowManufacturingWIPV2 {
  id: string;
  lotProduct: string;
  progress: number;
  totalPieces: number;
  completedPieces: number;
  shift: string;
  startTime: string;
  eta: string;
}

export interface LiveNowDispatchV2 {
  id: string;
  dcClient: string;
  vehicleDriver: string;
  departed: string;
  eta: string;
  status: 'En Route' | 'Reached' | 'Delayed';
}

export interface SalesQuoteV2 {
  id: string;
  clientProject: string;
  value: number;
  status: string;
  statusType: 'Tech Approval' | 'Pricing' | 'Docs Pending';
  pendingSince: string;
}

export interface SalesOrderV2 {
  id: string;
  client: string;
  orderNo: string;
  orderDate: string;
  value: number;
}

export interface UpcomingVisit {
  id: string;
  date: string;
  dayOfWeek: string;
  company: string;
  visitType: string;
  assignedTo: {
    name: string;
    initials: string;
  };
  time: string;
  status: 'Today' | 'Tomorrow' | string;
}

export interface ProjectV2 {
  id: string;
  projectManager: string;
  managerInitials: string;
  progress: number;
  nextMilestone: string;
  milestoneDate: string;
  status: 'On Track' | 'At Risk' | 'Delayed';
}

export interface ProformaAdvanceV2 {
  id: string;
  company: string;
  poValue: number;
  advanceReceived: number;
  advancePercentage: number;
  pendingAmount: number;
}

export interface OverdueReceivableV2 {
  id: string;
  company: string;
  invoice: string;
  dueDate: string;
  amount: number;
  daysOverdue: number;
}

// Mock Data Sets V2
const needsAttentionDataV2: NeedsAttentionItemV2[] = [
  {
    id: '1',
    type: 'warn',
    tagLabel: 'ADVANCE PENDING',
    title: 'RMG Polyvinyl India Ltd',
    context: 'PO received 65 days ago',
    amount: 845000,
    days: 65,
    link: '/invoices',
    owner: { name: 'Rajesh Kumar', initials: 'RK' },
    statusBadge: { text: '65 days', type: 'days' }
  },
  {
    id: '2',
    type: 'alert',
    tagLabel: 'WORK STOPPED',
    title: 'L&T – Dahej Site',
    context: 'Material not received',
    amount: 120000,
    days: 3,
    link: '/manufacturing',
    owner: { name: 'Vikram Singh', initials: 'VS' },
    statusBadge: { text: '3 days', type: 'days' }
  },
  {
    id: '3',
    type: 'alert',
    tagLabel: 'OVERDUE PAYMENT',
    title: 'Addison & Co',
    context: 'Invoice INV-2451 overdue',
    amount: 362500,
    days: 8,
    link: '/invoices',
    owner: { name: 'Mahesh Yadav', initials: 'MY' },
    statusBadge: { text: '8 days', type: 'days' }
  },
  {
    id: '4',
    type: 'alert',
    tagLabel: 'PO NOT RECEIVED',
    title: 'Prakash Techno Plast',
    context: 'Confirmed on 18 Jul 2026',
    amount: 578000,
    days: 2,
    link: '/sales',
    owner: { name: 'Rajesh Kumar', initials: 'RK' },
    statusBadge: { text: '2 days', type: 'days' }
  },
  {
    id: '5',
    type: 'warn',
    tagLabel: 'QC REJECTION',
    title: 'Lot #A231 – PN20 Green',
    context: 'Pressure test failed',
    amount: null,
    days: 1,
    link: '/manufacturing',
    owner: { name: 'Mahesh Yadav', initials: 'MY' },
    statusBadge: { text: 'Today', type: 'Today' }
  },
  {
    id: '6',
    type: 'info',
    tagLabel: 'DELIVERY DELAY',
    title: 'DC1421 – Mumbai',
    context: 'Traffic & route delay',
    amount: null,
    days: 1,
    link: '/dc/list',
    owner: { name: 'Ramesh Patel', initials: 'RP' },
    statusBadge: { text: 'Today', type: 'Today' }
  }
];

const siteCheckInsDataV2: LiveNowSiteCheckInV2[] = [
  { id: '1', time: '08:05 AM', engineer: 'Rahul Patel', siteActivity: 'Dahej Plant\nMechanical Installation', status: 'GPS Verified', statusType: 'verified' },
  { id: '2', time: '09:15 AM', engineer: 'Ajay Singh', siteActivity: 'Surat – Galaxy Textiles\nPPR Welding', status: 'Photo Uploaded', statusType: 'uploaded' },
  { id: '3', time: '10:02 AM', engineer: 'Nilesh Parmar', siteActivity: 'Vadodara – IPCL\nLine Testing', status: 'On Site', statusType: 'onsite' },
  { id: '4', time: '10:45 AM', engineer: 'Jatin Desai', siteActivity: 'Ankleshwar – GNFC\nMaterial Inspection', status: 'Checked In', statusType: 'checkedin' }
];

const manufacturingWIPDataV2: LiveNowManufacturingWIPV2[] = [
  { id: '1', lotProduct: 'Lot #A231\nPPR PN20 Green', progress: 70, totalPieces: 600, completedPieces: 420, shift: 'Shift B', startTime: '06:00 AM', eta: '02:00 PM' },
  { id: '2', lotProduct: 'Lot #A228\nPPR PN16 Blue', progress: 62, totalPieces: 500, completedPieces: 310, shift: 'Shift A', startTime: '02:00 PM', eta: '04:30 PM' },
  { id: '3', lotProduct: 'Lot #A226\nPPR PN20 Green', progress: 37, totalPieces: 400, completedPieces: 150, shift: 'Shift C', startTime: '10:00 PM', eta: '06:30 PM' }
];

const dispatchDataV2: LiveNowDispatchV2[] = [
  { id: '1', dcClient: 'DC1421\nRMG Polyvinyl India Ltd', vehicleDriver: 'MH04AB1234\nRamesh Patel', departed: '09:35 AM\n28 Jul', eta: '03:20 PM\n28 Jul', status: 'En Route' },
  { id: '2', dcClient: 'DC1420\nAddison & Co', vehicleDriver: 'GJ05CD5678\nJignesh Chauhan', departed: '08:15 AM\n28 Jul', eta: '02:10 PM\n28 Jul', status: 'En Route' },
  { id: '3', dcClient: 'DC1418\nPrakash Techno Plast', vehicleDriver: 'GJ06EF9101\nMahendra Solanki', departed: '07:40 AM\n28 Jul', eta: '12:45 PM\n28 Jul', status: 'Reached' }
];

const quotesToBeSentDataV2: SalesQuoteV2[] = [
  { id: '1', clientProject: 'ABC Tools Pvt Ltd', value: 1845000, status: 'Tech Approval', statusType: 'Tech Approval', pendingSince: '2 days' },
  { id: '2', clientProject: 'Jindal Steel & Power', value: 2780000, status: 'Pricing', statusType: 'Pricing', pendingSince: '5 days' },
  { id: '3', clientProject: 'Galaxy Textiles', value: 965000, status: 'Docs Pending', statusType: 'Docs Pending', pendingSince: 'Today' }
];

const openSalesOrdersDataV2: SalesOrderV2[] = [
  { id: '1', client: 'RMG Polyvinyl India Ltd', orderNo: 'SO1256', orderDate: '22 Jul 2026', value: 2450000 },
  { id: '2', client: 'Addison & Co', orderNo: 'SO1255', orderDate: '20 Jul 2026', value: 1175000 },
  { id: '3', client: 'IPCL', orderNo: 'SO1254', orderDate: '18 Jul 2026', value: 780000 }
];

const upcomingVisitsData: UpcomingVisit[] = [
  {
    id: '1',
    date: '28',
    dayOfWeek: 'JUL',
    company: 'Prakash Techno Plast',
    visitType: 'Site Visit – Machine Installation',
    assignedTo: { name: 'Rahul Mehta', initials: 'RM' },
    time: '02:30 PM',
    status: 'Today'
  },
  {
    id: '2',
    date: '29',
    dayOfWeek: 'JUL',
    company: 'Addison & Co',
    visitType: 'Follow-up – PO Discussion',
    assignedTo: { name: 'Vikram Singh', initials: 'VS' },
    time: '11:00 AM',
    status: 'Tomorrow'
  },
  {
    id: '3',
    date: '30',
    dayOfWeek: 'JUL',
    company: 'RMG Polyvinyl India Ltd',
    visitType: 'Technical Clarification',
    assignedTo: { name: 'Rajesh Kumar', initials: 'RK' },
    time: '03:00 PM',
    status: '2 days'
  }
];

const projectDataV2: ProjectV2[] = [
  {
    id: '1',
    projectManager: 'Dahej Plant Expansion\nVikram Singh',
    managerInitials: 'VS',
    progress: 68,
    nextMilestone: 'Piping Completion\n28 Aug 2026',
    milestoneDate: '28 Aug 2026',
    status: 'On Track'
  },
  {
    id: '2',
    projectManager: 'Surat Unit Upgrade\nMahesh Yadav',
    managerInitials: 'MY',
    progress: 45,
    nextMilestone: 'Equipment Delivery\n05 Aug 2026',
    milestoneDate: '05 Aug 2026',
    status: 'At Risk'
  },
  {
    id: '3',
    projectManager: 'Ankleshwar New Line\nJatin Desai',
    managerInitials: 'JD',
    progress: 23,
    nextMilestone: 'Civil Work Start\n10 Aug 2026',
    milestoneDate: '10 Aug 2026',
    status: 'Delayed'
  }
];

const proformaAdvanceDataV2: ProformaAdvanceV2[] = [
  {
    id: '1',
    company: 'RMG Polyvinyl India Ltd',
    poValue: 1420000,
    advanceReceived: 285000,
    advancePercentage: 20,
    pendingAmount: 1135000
  },
  {
    id: '2',
    company: 'Addison & Co',
    poValue: 860000,
    advanceReceived: 172000,
    advancePercentage: 20,
    pendingAmount: 688000
  }
];

const overdueReceivablesDataV2: OverdueReceivableV2[] = [
  {
    id: '1',
    company: 'IPCL',
    invoice: 'INV-2451',
    dueDate: '20 Jul 2026',
    amount: 362500,
    daysOverdue: 8
  },
  {
    id: '2',
    company: 'Galaxy Textiles',
    invoice: 'INV-2433',
    dueDate: '23 Jul 2026',
    amount: 148000,
    daysOverdue: 5
  }
];

// Helper to simulate network delay
const delay = <T>(data: T, ms = 800): Promise<T> => new Promise(resolve => setTimeout(() => resolve(data), ms));

export const fetchNeedsAttentionV2 = () => delay(needsAttentionDataV2);
export const fetchSiteCheckInsV2 = () => delay(siteCheckInsDataV2);
export const fetchManufacturingWIPV2 = () => delay(manufacturingWIPDataV2);
export const fetchDispatchV2 = () => delay(dispatchDataV2);
export const fetchQuotesToBeSentV2 = () => delay(quotesToBeSentDataV2);
export const fetchOpenSalesOrdersV2 = () => delay(openSalesOrdersDataV2);
export const fetchUpcomingVisits = () => delay(upcomingVisitsData);
export const fetchProjectActivityV2 = () => delay(projectDataV2);
export const fetchProformaAdvanceV2 = () => delay(proformaAdvanceDataV2);
export const fetchOverdueReceivables = () => delay(overdueReceivablesDataV2);