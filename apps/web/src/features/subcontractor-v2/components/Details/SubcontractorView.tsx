import { useState } from 'react';
import { useAuth } from '../../../../App';
import { useQuery } from '@tanstack/react-query';
import { subcontractorService } from '../../services/subcontractorService';
import { 
  Building2, 
  User, 
  Briefcase, 
  MapPin, 
  ShieldCheck, 
  FileText, 
  Users, 
  FileSignature, 
  CheckCircle, 
  MessageSquare, 
  RefreshCcw 
} from 'lucide-react';
import { useSubcontractor } from '../../hooks/useSubcontractor';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useAttendance } from '../../hooks/useAttendance';
import { useDailyLogs } from '../../hooks/useDailyLogs';
import { usePayments } from '../../hooks/usePayments';
import { useDocuments } from '../../hooks/useDocuments';

import { OverviewTab } from './OverviewTab';
import { WorkOrdersTab } from '../WorkOrders/WorkOrdersTab';
import { AttendanceTab } from '../Attendance/AttendanceTab';
import { DailyLogsTab } from '../DailyLogs/DailyLogsTab';
import { PaymentsTab } from '../Payments/PaymentsTab';
import { SubcontractorLedger } from '../Payments/SubcontractorLedger';
import { DocumentsTab } from '../Documents/DocumentsTab';
import { CommunicationsTab } from './CommunicationsTab';

const getCurrentQueryParams = () => new URLSearchParams(window.location.search);

interface SubcontractorViewProps {
  onNavigate: (path: string) => void;
}

export function SubcontractorView({ onNavigate }: SubcontractorViewProps) {
  const { organisation } = useAuth();
  const organisationId = organisation?.id || null;
  const subId = getCurrentQueryParams().get('id');

  const [activeTab, setActiveTab] = useState('details');

  const { subcontractor: sub, isLoading: isSubLoading, refetch: refetchSub } = useSubcontractor(subId, organisationId);
  const { workOrders, isLoading: isWOsLoading } = useWorkOrders(subId, organisationId);
  const { attendance, isLoading: isAttLoading } = useAttendance(subId, organisationId);
  const { dailyLogs, manpowerAttendance, labourCategories, isLoading: isLogsLoading, refetch: refetchLogs } = useDailyLogs(subId, organisationId);
  const { payments, isLoading: isPaymentsLoading } = usePayments(subId, organisationId);
  const { documents, isLoading: isDocsLoading, refetch: refetchDocs } = useDocuments(subId, organisationId);

  const communicationsQuery = useQuery({
    queryKey: ['subcontractors-v2', 'communications', subId],
    queryFn: async () => {
      if (!subId || !organisationId) return [];
      return subcontractorService.getCommunications(subId, organisationId);
    },
    enabled: !!subId && !!organisationId,
  });

  const communications = communicationsQuery.data || [];

  if (isSubLoading || !sub) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8fafc',
      }}>
        <RefreshCcw size={40} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const tabs = [
    { id: 'details', label: 'Partner Profile', icon: Building2 },
    { id: 'workorders', label: `Work Orders (${workOrders.length})`, icon: Briefcase },
    { id: 'attendance', label: `Force Count (${attendance.length})`, icon: Users },
    { id: 'ledger', label: 'Financial Ledger', icon: FileText },
    { id: 'dailylogs', label: 'Daily Reports', icon: FileSignature },
    { id: 'payments', label: 'Payout History', icon: CheckCircle },
    { id: 'communications', label: `Communication Log (${communications.length})`, icon: MessageSquare },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Profile Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '8px',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}>
              <Building2 size={40} style={{ color: '#2563eb' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: '#171717',
                  margin: 0,
                }}>
                  {sub.company_name}
                </h1>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: sub.status === 'Active' ? '#ecfdf5' : '#f3f4f6',
                  color: sub.status === 'Active' ? '#059669' : '#6b7280',
                  border: sub.status === 'Active' ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                }}>
                  {sub.status}
                </div>
              </div>
              <div style={{
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#9ca3af',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '16px', borderRight: '1px solid #e5e7eb' }}>
                  <User size={14} style={{ color: '#d1d5db' }} />
                  {sub.contact_person || 'No Contact'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '16px', borderRight: '1px solid #e5e7eb' }}>
                  <Briefcase size={14} style={{ color: '#d1d5db' }} />
                  {sub.nature_of_work || 'General Works'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ color: '#d1d5db' }} />
                  {sub.state || 'Unknown Territory'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onNavigate('/subcontractors-v2')}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Partner List
            </button>
            <button
              onClick={() => { window.subToEdit = sub; onNavigate('/subcontractors-v2/edit?id=' + sub.id); }}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '24px',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === tab.id ? '#171717' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#9ca3af',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => activeTab !== tab.id && (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => activeTab !== tab.id && (e.currentTarget.style.background = 'transparent')}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div>
          {activeTab === 'details' && <OverviewTab subcontractor={sub} />}

          {activeTab === 'workorders' && (
            <WorkOrdersTab 
              workOrders={workOrders} 
              subcontractorId={sub.id} 
              onNavigate={onNavigate} 
            />
          )}

          {activeTab === 'attendance' && <AttendanceTab attendance={attendance} />}

          {activeTab === 'dailylogs' && (
            <DailyLogsTab 
              dailyLogs={dailyLogs} 
              manpowerAttendance={manpowerAttendance} 
              labourCategories={labourCategories} 
            />
          )}

          {activeTab === 'payments' && <PaymentsTab payments={payments} />}

          {activeTab === 'communications' && <CommunicationsTab communications={communications} />}

          {activeTab === 'ledger' && (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}>
              <SubcontractorLedger
                subcontractorId={sub.id}
                subcontractorName={sub.company_name}
                onBack={() => setActiveTab('details')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default SubcontractorView;
