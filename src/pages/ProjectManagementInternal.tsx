export { BOQ } from './BOQ';

export function SiteMaterials() { return <div><div className="card"><div className="empty-state"><h3>Site Materials</h3><p>Manage materials at project site</p></div></div></div>; }
export function ToolsList() { return <div><div className="page-header"><h1 className="page-title">Tools</h1></div><div className="card"><div className="empty-state"><h3>Tools</h3><p>Monitoring tools</p></div></div></div>; }
export function ClientComm() { return <div><div className="page-header"><h1 className="page-title">Client Communication</h1></div><div className="card"><div className="empty-state"><h3>Client Communication</h3></div></div></div>; }
export function Documents() { return <div><div className="page-header"><h1 className="page-title">Documents</h1></div><div className="card"><div className="empty-state"><h3>Documents</h3></div></div></div>; }

import { IssueDashboard, IssueListPage, IssueDetailPage } from '../issues';
export function IssueList() { return <IssueDashboard />; }
export function IssueAllList() { return <IssueListPage />; }
export function IssueViewDetail({ id }: { id?: string }) { return id ? <IssueDetailPage /> : <IssueListPage />; }