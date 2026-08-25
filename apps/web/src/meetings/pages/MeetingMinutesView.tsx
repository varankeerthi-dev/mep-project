import { useState, useEffect, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Edit, FileText, Users, Printer } from 'lucide-react';
import { useAuth } from '../../App';
import {
  getMeetingById,
  getMeetingMinutesItems,
  getMeetingTopics,
  getMeetingDecisions,
  getMeetingLinks,
  getMeetingAuditEvents,
  getMeetingAttendees,
} from '../api/meetings';
import { MinutesTable } from '../components/MinutesTable';
import { AttendeeList } from '../components/AttendeeList';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const MeetingMinutesView = memo(function MeetingMinutesView({ meetingId }: { meetingId?: string }) {
  const { user, organisation } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = meetingId || params.id;
  
  const [meeting, setMeeting] = useState<any>(null);
  const [minutesItems, setMinutesItems] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadMeetingData();
  }, [id]);

  const loadMeetingData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [meetingData, minutesData, topicsData, decisionsData, linksData, auditData, attendeesData] = await Promise.all([
        getMeetingById(id),
        getMeetingMinutesItems(id),
        getMeetingTopics(id),
        getMeetingDecisions(id),
        getMeetingLinks(id),
        getMeetingAuditEvents(id),
        getMeetingAttendees(id)
      ]);
      
      setMeeting(meetingData);
      setMinutesItems(minutesData);
      setTopics(topicsData);
      setDecisions(decisionsData);
      setLinks(linksData);
      setAuditEvents(auditData);
      setAttendees(attendeesData);
    } catch (error) {
      console.error('Error loading meeting data:', error);
      toast.error('Failed to load meeting data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!meeting || minutesItems.length === 0) {
      toast.error('No minutes to export');
      return;
    }

    try {
      setExporting(true);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Minutes of Meeting', pageWidth / 2, 20, { align: 'center' });
      
      // Meeting Info Grid
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      const startY = 35;
      const colWidth = pageWidth / 3;
      
      // Column 1: Client
      doc.text('Client Name:', 14, startY);
      doc.setFont('helvetica', 'bold');
      doc.text(meeting.client_name || '-', 14, startY + 7);
      
      // Column 2: Vendor
      doc.setFont('helvetica', 'normal');
      doc.text('Vendor Name:', colWidth + 14, startY);
      doc.setFont('helvetica', 'bold');
      doc.text(meeting.vendor_name || '-', colWidth + 14, startY + 7);
      
      // Column 3: Date/Time/Location
      doc.setFont('helvetica', 'normal');
      doc.text('Date & Time:', colWidth * 2 + 14, startY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${meeting.meeting_date} ${meeting.meeting_time || ''}`, colWidth * 2 + 14, startY + 7);
      doc.setFont('helvetica', 'normal');
      doc.text('Location:', colWidth * 2 + 14, startY + 14);
      doc.setFont('helvetica', 'bold');
      doc.text(meeting.location || '-', colWidth * 2 + 14, startY + 21);
      
      // Attendees
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Attendees', 14, startY + 35);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const attendeeText = attendees.map(a => `${a.name}${a.organisation ? ` (${a.organisation})` : ''}`).join(', ');
      doc.text(attendeeText || '-', 14, startY + 42, { maxWidth: pageWidth - 28 });
      
      // Minutes Table
      const tableStartY = startY + 52;
      
      const tableData = minutesItems.map((item, index) => [
        index + 1,
        item.description || '-',
        item.client_scope || '-',
        item.vendor_scope || '-',
        item.target_date || '-',
        item.remarks || '-',
        item.requirement || '-'
      ]);
      
      autoTable(doc, {
        startY: tableStartY,
        head: [['S.No', 'Description', 'Client Scope', 'Vendor Scope', 'Target Date', 'Remarks', 'Requirement']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 50 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 25 },
          5: { cellWidth: 35 },
          6: { cellWidth: 35 }
        }
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
      
      doc.save(`minutes-${meeting.client_name}-${meeting.meeting_date}.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = () => {
    if (meeting?.minutes_status === 'finalized') {
      if (!confirm('These minutes are finalized. Create a new version?')) {
        return;
      }
    }
    navigate(`/meetings/${id}/minutes`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Meeting not found</div>
      </div>
    );
  }

  return (
    <div className="meeting-minutes-view">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/meetings')}
            className="p-2 hover:bg-slate-100 rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">View Minutes</h1>
            <p className="text-sm text-slate-600">
              {meeting.client_name} {meeting.vendor_name && `| ${meeting.vendor_name}`} | {meeting.meeting_date}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            <Edit size={16} />
            Edit
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || minutesItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Meeting Info Header */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Meeting Information</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Client Name</label>
              <div className="p-2 bg-slate-50 rounded text-sm">{meeting.client_name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Vendor Name</label>
              <div className="p-2 bg-slate-50 rounded text-sm">{meeting.vendor_name || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Date & Time</label>
              <div className="p-2 bg-slate-50 rounded text-sm">
                {meeting.meeting_date} {meeting.meeting_time && `at ${meeting.meeting_time}`}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Location</label>
              <div className="p-2 bg-slate-50 rounded text-sm">{meeting.location || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Meeting Type</label>
              <div className="p-2 bg-slate-50 rounded text-sm capitalize">{meeting.meeting_type}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
              <div className="p-2 bg-slate-50 rounded text-sm capitalize">
                <span className={`px-2 py-1 rounded text-xs ${
                  meeting.minutes_status === 'finalized' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {meeting.minutes_status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit History */}
        {auditEvents.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Document History</h2>
            <div className="space-y-2">
              {auditEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2 text-sm">
                  <span className="capitalize text-slate-700">{String(event.event_type).replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Work Links */}
        {links.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Linked Project Work</h2>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <span key={link.id} className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800">
                  <span className="font-medium capitalize">{link.entity_type}:</span> {link.entity_name || link.entity_id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Discussion Topics */}
        {topics.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Discussion Topics</h2>
            <div className="space-y-3">
              {topics.map((topic) => (
                <div key={topic.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium text-slate-900">{topic.title}</h3>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs capitalize text-slate-600">{topic.status}</span>
                  </div>
                  {topic.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{topic.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decisions */}
        {decisions.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Decisions</h2>
            <div className="space-y-3">
              {decisions.map((decision) => (
                <div key={decision.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap font-medium text-slate-900">{decision.decision}</p>
                    <span className={`rounded px-2 py-1 text-xs capitalize ${
                      decision.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>{decision.status}</span>
                  </div>
                  {decision.owner_name && <p className="mt-2 text-sm text-slate-600">Owner: {decision.owner_name}</p>}
                  {decision.rationale && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{decision.rationale}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendees */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users size={18} />
            Attendees ({attendees.length})
          </h2>
          <AttendeeList
            attendees={attendees.map(a => ({
              id: a.id,
              name: a.name,
              email: a.email || '',
              role: a.role,
              organisation: a.organisation || ''
            }))}
            onChange={() => {}}
            readonly={true}
          />
        </div>

        {/* Minutes Table */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Minutes</h2>
          <MinutesTable
            items={minutesItems.map(item => ({
              id: item.id,
              serial_number: item.serial_number,
              description: item.description || '',
              client_scope: item.client_scope || '',
              vendor_scope: item.vendor_scope || '',
              target_date: item.target_date || '',
              remarks: item.remarks || '',
              requirement: item.requirement || ''
            }))}
            onChange={() => {}}
            readonly={true}
          />
        </div>
      </div>
    </div>
  );
});

export default MeetingMinutesView;
