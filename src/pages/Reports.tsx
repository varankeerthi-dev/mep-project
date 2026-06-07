// ============================================
// Reports — Phase 6.3 (soak telemetry export)
// ============================================
// The pre-existing Reports module exports the 4
// stub report components (StockBalance, StockReport,
// PurchaseReport, SalesReport). Phase 6.3 adds a
// 5th export — `DailyReportSoak` — which renders
// the v2 daily-report adoption KPIs in the 2-week
// soak window. Mounted at `/reports/daily-report-soak`
// (registered in App.tsx) and embeddable in the
// rollup page header.
//
// Keeping the export here (vs. in modules/DailyReport)
// so the existing Reports module barrel continues to
// work for the legacy /reports routes.
// ============================================

import { DailyReportSoakCard } from '@/modules/DailyReport/components/DailyReportSoakCard';
export { DailyReportSoakCard };

/** Re-export the soak card under a Reports-style name. */
export function DailyReportSoak() {
  return <DailyReportSoakCard />;
}

export function StockBalance() { return <div><div className="page-header"><h1 className="page-title">Stock Balance</h1></div><div className="card"><div className="empty-state"><h3>Stock Balance</h3></div></div></div>; }
export function StockReport() { return <div><div className="page-header"><h1 className="page-title">Stock Report</h1></div><div className="card"><div className="empty-state"><h3>Stock Report</h3></div></div></div>; }
export function PurchaseReport() { return <div><div className="page-header"><h1 className="page-title">Purchase Report</h1></div><div className="card"><div className="empty-state"><h3>Purchase Report</h3></div></div></div>; }
export function SalesReport() { return <div><div className="page-header"><h1 className="page-title">Sales Report</h1></div><div className="card"><div className="empty-state"><h3>Sales Report</h3></div></div></div>; }
