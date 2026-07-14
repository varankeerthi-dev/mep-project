// src/pages/operations/api/mockData.ts

export interface NeedsAttentionItem {
  id: string;
  type: 'alert' | 'warn';
  tagLabel: string;
  title: string;
  context: string;
  amount: number | null;
  days: number;
  link: string;
}

export interface LiveNowSiteCheckIn {
  id: string;
  name: string;
  location: string;
  time: string;
  initials: string;
}

export interface LiveNowManufacturingWIP {
  id: string;
  name: string;
  progress: number;
  meta: string;
  status: 'on-track' | 'behind';
}

export interface LiveNowDispatch {
  id: string;
  dispatchId: string;
  destination: string;
  timeBadge: string;
  badgeType: 'brand' | 'warn' | 'info';
}

export interface SalesQuote {
  id: string;
  client: string;
  context: string;
  badgeType: 'info' | 'warn';
  badgeLabel: string;
  daysSince: string;
}

export interface SalesOrder {
  id: string;
  client: string;
  orderNo: string;
  value: number;
}

export interface SalesConfirmedAwaitingPO {
  id: string;
  client: string;
  daysWaiting: number;
  value: number;
}

export interface UpcomingEvent {
  id: string;
  type: 'visit' | 'production';
  title: string;
  meta: string;
  tag: string;
}

export interface ProjectActivity {
  id: string;
  name: string;
  progress: number;
  manager: string | null; // null means unassigned (amber bar)
  nextMilestone: string;
  date: string;
}

export interface PlanningShutdownEvent {
  id: string;
  type: 'planning' | 'shutdown';
  title: string;
  context: string;
}

export interface BlockingWorkItem {
  id: string;
  project: string;
  context: string;
  workStarted: string;
  stoppedSince: string;
  daysStopped: number;
  pendingAmount: number;
}

export interface ProformaAdvanceItem {
  id: string;
  client: string;
  context: string;
  poDate: string;
  terms: string;
  receivedPct: number;
  status: 'On track' | 'Grace period' | 'Procurement on hold';
  daysSincePO: number;
  pendingAmount: number;
}

export interface DueTodayItem {
  id: string;
  type: 'cheque' | 'emi' | 'vendor' | 'client';
  description: string;
  subLabel: string;
  amount: number;
  isUpcoming?: boolean; // false for today, true for upcoming
}

export interface PayableReceivableItem {
  id: string;
  name: string;
  invoiceRef: string;
  aging: 'ok' | 'warn' | 'alert';
  agingText: string;
  amount: number;
  dueDate: string;
  paymentMode: string;
  bank: string;
  contact: string;
  link: string;
}

// Mock Data Sets
const needsAttentionData: NeedsAttentionItem[] = [
  { id: '1', type: 'alert', tagLabel: 'PAYMENT', title: 'TechCorp India', context: 'Advance payment overdue on PO-2041', amount: 450000, days: 7, link: '/invoices' },
  { id: '2', type: 'warn', tagLabel: 'DISPATCH', title: 'Pune Site A', context: 'Truck delayed at border checkpoint', amount: null, days: 2, link: '/dc/list' },
  { id: '3', type: 'alert', tagLabel: 'PRODUCTION', title: 'Batch #4412', context: 'Slippage against planned schedule', amount: null, days: 3, link: '/manufacturing' }
];

const siteCheckInsData: LiveNowSiteCheckIn[] = [
  { id: '1', name: 'Rahul Verma', location: 'Pune Site A', time: '08:42 AM', initials: 'RV' },
  { id: '2', name: 'Amit Singh', location: 'Mumbai HQ', time: '09:15 AM', initials: 'AS' },
  { id: '3', name: 'Neha Sharma', location: 'Delhi Site B', time: '10:05 AM', initials: 'NS' }
];

const manufacturingWIPData: LiveNowManufacturingWIP[] = [
  { id: '1', name: 'Line A - Assembly', progress: 75, meta: 'Batch #4412', status: 'on-track' },
  { id: '2', name: 'Line B - Welding', progress: 40, meta: 'Batch #4413', status: 'behind' }
];

const dispatchData: LiveNowDispatch[] = [
  { id: '1', dispatchId: 'DC-9921', destination: 'Pune Site A', timeBadge: '2h ago', badgeType: 'info' },
  { id: '2', dispatchId: 'DC-9922', destination: 'Mumbai HQ', timeBadge: '5h ago', badgeType: 'warn' }
];

const quotesToBeSentData: SalesQuote[] = [
  { id: '1', client: 'Alpha Industries', context: 'Site visit completed', badgeType: 'info', badgeLabel: 'Quote to be sent', daysSince: '2d' },
  { id: '2', client: 'Beta Corp', context: 'Requested via email', badgeType: 'warn', badgeLabel: 'Revised quote requested', daysSince: '4d' }
];

const openSalesOrdersData: SalesOrder[] = [
  { id: '1', client: 'Gamma Tech', orderNo: 'SO-1024', value: 1250000 },
  { id: '2', client: 'Delta Systems', orderNo: 'SO-1025', value: 840000 }
];

const confirmedAwaitingPOData: SalesConfirmedAwaitingPO[] = [
  { id: '1', client: 'Epsilon Ltd', daysWaiting: 5, value: 3200000 },
  { id: '2', client: 'Zeta Inc', daysWaiting: 12, value: 1500000 }
];

const upcomingEventsData: UpcomingEvent[] = [
  { id: '1', type: 'visit', title: 'Site Survey: Omega Corp', meta: 'Tomorrow, 10:00 AM', tag: 'Visit' },
  { id: '2', type: 'production', title: 'Start Batch #4414', meta: 'Wed, 08:00 AM', tag: 'Production' }
];

const projectActivityData: ProjectActivity[] = [
  { id: '1', name: 'Omega HQ Installation', progress: 60, manager: 'R. Sharma', nextMilestone: 'HVAC Testing', date: 'Oct 24' },
  { id: '2', name: 'Sigma Site Prep', progress: 15, manager: null, nextMilestone: 'Initial survey', date: 'Oct 26' }
];

const planningShutdownData: PlanningShutdownEvent[] = [
  { id: '1', type: 'planning', title: 'Q4 Resource Allocation', context: 'All managers' },
  { id: '2', type: 'shutdown', title: 'Line B Maintenance', context: 'Expect 24h delay on Batch #4413' }
];

const blockingWorkData: BlockingWorkItem[] = [
  { id: '1', project: 'TechCorp India', context: 'Started on urgency, before advance received', workStarted: '01 Oct 2026', stoppedSince: '10 Oct 2026', daysStopped: 4, pendingAmount: 450000 }
];

const proformaAdvanceData: ProformaAdvanceItem[] = [
  { id: '1', client: 'Global Systems', context: 'PO-2026-88', poDate: '05 Oct 2026', terms: '30% advance on PO', receivedPct: 0, status: 'Grace period', daysSincePO: 9, pendingAmount: 900000 },
  { id: '2', client: 'Nexus Tech', context: 'PO-2026-92', poDate: '12 Oct 2026', terms: '50% advance on PO', receivedPct: 50, status: 'On track', daysSincePO: 2, pendingAmount: 1500000 }
];

const dueTodayData: DueTodayItem[] = [
  { id: '1', type: 'emi', description: 'HDFC Machine Loan', subLabel: 'Auto-debit', amount: 125000, isUpcoming: false },
  { id: '2', type: 'cheque', description: 'Steel Suppliers Ltd', subLabel: 'Cheque #882199', amount: 340000, isUpcoming: false },
  { id: '3', type: 'vendor', description: 'Freight Corp', subLabel: 'Logistics', amount: 45000, isUpcoming: true }
];

const payablesData: PayableReceivableItem[] = [
  { id: '1', name: 'Steel Suppliers Ltd', invoiceRef: 'INV-2026-112', aging: 'alert', agingText: '> 30 days', amount: 340000, dueDate: '15 Sep 2026', paymentMode: 'Cheque', bank: 'HDFC', contact: 'accounts@steelsuppliers.com', link: '/ledger' },
  { id: '2', name: 'Freight Corp', invoiceRef: 'FC-9921', aging: 'warn', agingText: '15-30 days', amount: 45000, dueDate: '01 Oct 2026', paymentMode: 'NEFT', bank: 'SBI', contact: 'billing@freightcorp.com', link: '/ledger' }
];

const receivablesData: PayableReceivableItem[] = [
  { id: '1', name: 'TechCorp India', invoiceRef: 'PI-2041', aging: 'alert', agingText: '> 30 days', amount: 450000, dueDate: '10 Sep 2026', paymentMode: 'NEFT', bank: 'ICICI', contact: 'finance@techcorp.in', link: '/proforma-invoices' },
  { id: '2', name: 'Global Systems', invoiceRef: 'PI-2055', aging: 'ok', agingText: '< 15 days', amount: 900000, dueDate: '20 Oct 2026', paymentMode: 'NEFT', bank: 'ICICI', contact: 'accounts@globalsystems.com', link: '/proforma-invoices' }
];

// Helper to simulate network delay
const delay = <T>(data: T, ms = 800): Promise<T> => new Promise(resolve => setTimeout(() => resolve(data), ms));

export const fetchNeedsAttention = () => delay(needsAttentionData);
export const fetchSiteCheckIns = () => delay(siteCheckInsData);
export const fetchManufacturingWIP = () => delay(manufacturingWIPData);
export const fetchDispatch = () => delay(dispatchData);
export const fetchQuotesToBeSent = () => delay(quotesToBeSentData);
export const fetchOpenSalesOrders = () => delay(openSalesOrdersData);
export const fetchConfirmedAwaitingPO = () => delay(confirmedAwaitingPOData);
export const fetchUpcomingEvents = () => delay(upcomingEventsData);
export const fetchProjectActivity = () => delay(projectActivityData);
export const fetchPlanningShutdown = () => delay(planningShutdownData);
export const fetchBlockingWork = () => delay(blockingWorkData);
export const fetchProformaAdvance = () => delay(proformaAdvanceData);
export const fetchDueToday = () => delay(dueTodayData);
export const fetchPayablesList = () => delay(payablesData);
export const fetchReceivablesList = () => delay(receivablesData);
