import React from 'react';
import { Download, Calendar } from 'lucide-react';
import { supabase } from '../../../supabase';
import { PermissionGuard } from '../../../rbac';
import { ScopeEditor } from '../../../components/projects/ScopeEditor';
import { ClosureChecklistPanel } from '../../../components/projects/ClosureChecklistPanel';
import { Button } from '@/components/ui/button';

interface SummaryTabProps {
  selectedProject: any;
  organisation: any;
  financialSummary: any;
  navigate: (path: string) => void;
  fmt: (val: any) => string;
  fmtD: (val: any) => string;
  formatCurrency: (val: number) => string;
}

export function SummaryTab({
  selectedProject,
  organisation,
  financialSummary,
  navigate,
  fmt,
  fmtD,
  formatCurrency,
}: SummaryTabProps) {

  const downloadCompletionCertificate = async (project: any) => {
    try {
      const orgId = project.organisation_id || organisation?.id;
      if (!orgId) {
        alert('Organisation ID not found');
        return;
      }

      // Fetch org details
      const { data: orgDetails, error: orgError } = await supabase
        .from('organisations')
        .select('name, address, phone, email, gstin, website')
        .eq('id', orgId)
        .single();

      if (orgError) {
        console.warn('Error fetching organisation details:', orgError);
      }

      const companyName = orgDetails?.name || organisation?.name || 'Organisation';
      const companyAddress = orgDetails?.address || '';
      const companyPhone = orgDetails?.phone || '';
      const companyEmail = orgDetails?.email || '';
      const companyGSTIN = orgDetails?.gstin || '';
      const companyWebsite = orgDetails?.website || '';

      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      // Border and Background styling
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setFillColor(255, 255, 255);
      doc.rect(28, 28, 539, 785.89, 'S');

      // Top Header Border Line (accent colors)
      doc.setDrawColor(59, 130, 246); // Blue 500
      doc.setLineWidth(3);
      doc.line(28, 28, 567, 28);
      doc.setLineWidth(1);

      // Company Info
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(companyName, 44, 70);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      let headerY = 86;
      if (companyAddress) {
        doc.text(companyAddress, 44, headerY, { maxWidth: 350 });
        const addressLines = doc.splitTextToSize(companyAddress, 350);
        headerY += addressLines.length * 11 + 3;
      }
      
      const contactInfo = [
        companyPhone ? `Phone: ${companyPhone}` : '',
        companyEmail ? `Email: ${companyEmail}` : '',
        companyGSTIN ? `GSTIN: ${companyGSTIN}` : '',
        companyWebsite ? `Website: ${companyWebsite}` : ''
      ].filter(Boolean).join('  |  ');
      
      if (contactInfo) {
        doc.text(contactInfo, 44, headerY);
        headerY += 15;
      }

      // Decorative divider
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(44, headerY + 5, 551, headerY + 5);

      // Title
      const titleY = headerY + 45;
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('PROJECT COMPLETION CERTIFICATE', 297.64, titleY, { align: 'center' });

      // Certificate Metadata
      const metaY = titleY + 30;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      
      const certNo = `Cert Ref: CC-${project.project_code || project.id.slice(0, 8).toUpperCase()}`;
      const dateStr = `Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      
      doc.text(certNo, 44, metaY);
      doc.text(dateStr, 551, metaY, { align: 'right' });

      // Main letter body
      const bodyY = metaY + 40;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // Slate 700
      
      const certText = `This is to certify that the project detailed below has been successfully completed in accordance with the contract specifications, agreed deliverables, and quality guidelines. We hereby confirm that all milestones have been executed, inspected, and handed over to the client.`;
      
      const textLines = doc.splitTextToSize(certText, 507);
      doc.text(textLines, 44, bodyY, { leading: 16 });

      // Project Details Card
      const cardY = bodyY + (textLines.length * 16) + 20;
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(44, cardY, 507, 185, 6, 6, 'FD');

      // Table/Grid of Project Details inside the card
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Project Details', 56, cardY + 22);

      doc.setDrawColor(226, 232, 240);
      doc.line(56, cardY + 30, 539, cardY + 30);

      // Label/Value details
      doc.setFontSize(9.5);
      const rowHeight = 22;
      let curRowY = cardY + 46;

      const formatDisplayVal = (val: any) => val ? String(val) : '-';

      const detailsData = [
        { label: 'Project Name', val: project.project_name },
        { label: 'Project Code', val: project.project_code },
        { label: 'Client / Customer', val: project.client?.client_name },
        { label: 'Project Type', val: project.project_type },
        { label: 'Commencement Date', val: project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '-' },
        { label: 'Completion Date', val: project.actual_end_date ? new Date(project.actual_end_date).toLocaleDateString('en-GB') : (project.expected_end_date ? new Date(project.expected_end_date).toLocaleDateString('en-GB') : '-') }
      ];

      detailsData.forEach((item) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, 56, curRowY);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(formatDisplayVal(item.val), 180, curRowY, { maxWidth: 350 });
        
        curRowY += rowHeight;
      });

      // Signature area
      const sigY = cardY + 230;
      doc.setDrawColor(226, 232, 240);
      doc.line(380, sigY + 50, 539, sigY + 50);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Authorized Signatory', 380, sigY + 66);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(companyName, 380, sigY + 80, { maxWidth: 170 });

      // Save PDF
      doc.save(`Completion_Certificate_${project.project_code || 'Project'}.pdf`);
    } catch (error) {
      console.error('Error downloading completion certificate:', error);
      alert('Failed to generate completion certificate. Please try again.');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {/* Download Certificate Button */}
        {Number(selectedProject.completion_percentage) === 100 &&
          ['Execution Completed', 'Closed', 'Financially Closed'].includes(selectedProject.status || '') && (
            <Button variant="default" size="default" style={{ background: '#10b981', color: '#ffffff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }} onClick={() => downloadCompletionCertificate(selectedProject)}
            >
              <Download size={14} />
              Download Completion Certificate
            </Button>
        )}

        {/* Schedule AMC Visit Button */}
        <Button variant="default" size="default" disabled={!selectedProject.client_id} title={!selectedProject.client_id ? "This project has no client linked" : "Schedule AMC / Maintenance visit"} style={{ background: selectedProject.client_id ? 'var(--pl-primary, #3b82f6)' : '#e2e8f0', color: selectedProject.client_id ? '#ffffff' : '#94a3b8', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: selectedProject.client_id ? 'pointer' : 'not-allowed', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }} onClick={() => {
            if (selectedProject.client_id) {
              navigate(`/site-visits?scheduleNew=true&projectId=${selectedProject.id}&clientId=${selectedProject.client_id}`);
            }
          }}
        >
          <Calendar size={14} />
          Schedule AMC / Maintenance Visit
        </Button>
      </div>

      <div className="pl-summary-grid">
        <div className="pl-summary-card">
          <h3 className="pl-summary-title">Commercial</h3>
          <div className="pl-summary-row">
            <span className="pl-summary-label">Client</span>
            <span className="pl-summary-value">{selectedProject.client?.client_name || '-'}</span>
          </div>
          <div className="pl-summary-row">
            <span className="pl-summary-label">Type</span>
            <span className="pl-summary-value">{selectedProject.project_type || '-'}</span>
          </div>
          <div className="pl-summary-row">
            <span className="pl-summary-label">Est. Value</span>
            <span className="pl-summary-value">{selectedProject.project_estimated_value ? fmt(selectedProject.project_estimated_value) : '-'}</span>
          </div>
          <div className="pl-summary-row">
            <span className="pl-summary-label">PO Status</span>
            <span className="pl-summary-value">{selectedProject.po_status || 'Pending'}</span>
          </div>
        </div>

        <div className="pl-summary-card">
          <h3 className="pl-summary-title">Execution</h3>
          <div className="pl-summary-row">
            <span className="pl-summary-label">Status</span>
            <span className="pl-summary-value">{selectedProject.status || 'Draft'}</span>
          </div>
          <div className="pl-summary-row">
            <span className="pl-summary-label">Start Date</span>
            <span className="pl-summary-value">{fmtD(selectedProject.start_date)}</span>
          </div>
          <div className="pl-summary-row">
            <span className="pl-summary-label">End Date</span>
            <span className="pl-summary-value">{fmtD(selectedProject.expected_end_date)}</span>
          </div>
          <div className="pl-summary-row">
            <span className="pl-summary-label">Completion</span>
            <span className="pl-summary-value">{selectedProject.completion_percentage || 0}%</span>
          </div>
        </div>
      </div>

      <div className="pl-card" style={{ padding: '1.25rem' }}>
        <h3 className="pl-summary-title" style={{ marginBottom: '1rem' }}>Financial Overview</h3>
        <div className="pl-financial-grid">
          <div className="pl-financial-card">
            <div className="pl-financial-label">PO Value</div>
            <div className="pl-financial-value">{fmt(financialSummary?.total_po_value)}</div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">Invoice</div>
            <div className="pl-financial-value">{fmt(financialSummary?.total_invoice_value)}</div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">Payments</div>
            <div className="pl-financial-value positive">{fmt(financialSummary?.total_payment_received)}</div>
          </div>
          <div className="pl-financial-card">
            <div className="pl-financial-label">Expenses</div>
            <div className="pl-financial-value negative">{fmt(financialSummary?.total_expense)}</div>
          </div>
        </div>
      </div>

      <div className="pl-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 className="pl-summary-title">Project Scope & Site Instructions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contractor Scope</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
              {selectedProject.contractor_scope || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Scope</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
              {selectedProject.client_scope || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excluded Scope</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
              {selectedProject.excluded_scope || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope Awaiting Approval</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
              {selectedProject.pending_approval || 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructions to Site Engineer</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
            {selectedProject.site_instructions || 'N/A'}
          </span>
        </div>
      </div>

      {/* Audit Info */}
      <div className="pl-card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {selectedProject.created_by_user?.full_name && (
          <span>Created by: <strong>{selectedProject.created_by_user.full_name}</strong></span>
        )}
        {selectedProject.updated_by_user?.full_name && (
          <span>Last updated by: <strong>{selectedProject.updated_by_user.full_name}</strong></span>
        )}
      </div>

      {/* Structured Scope Editor */}
      {selectedProject && selectedProject.status !== 'Archived' && (
        <PermissionGuard permission="projects.manage_scope">
          <div className="pl-card" style={{ padding: '1.25rem 1.5rem' }}>
            <h3 className="pl-summary-title" style={{ marginBottom: '1rem' }}>Scope Manager</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <ScopeEditor projectId={selectedProject.id} scopeType="contractor_scope" />
              <ScopeEditor projectId={selectedProject.id} scopeType="client_scope" />
              <ScopeEditor projectId={selectedProject.id} scopeType="excluded_scope" />
              <ScopeEditor projectId={selectedProject.id} scopeType="pending_approval" />
              <ScopeEditor projectId={selectedProject.id} scopeType="site_instructions" />
            </div>
          </div>
        </PermissionGuard>
      )}

      {/* Closure Checklist */}
      {selectedProject && ['Execution Completed', 'Financially Closed', 'Closed'].includes(selectedProject.status || '') && (
        <div className="pl-card" style={{ padding: '1.25rem 1.5rem' }}>
          <ClosureChecklistPanel projectId={selectedProject.id} />
        </div>
      )}
    </>
  );
}
