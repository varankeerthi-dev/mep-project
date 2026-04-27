import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  useIssue, 
  useIssueAttachments, 
  useIssueActivityLogs, 
  useIssueComments,
  useUpdateIssue,
  useUpdateIssueStatus,
  useAssignIssue,
  useAddIssueComment,
  useDeleteIssue,
} from '../hooks';
import {
  formatIssueDate,
  formatIssueDateTime,
  formatLocationPath,
  getSeverityStyles,
  getStatusStyles,
  getSystemLabel,
  getIssueTypeLabel,
  isIssueOverdue,
  canClose,
  canReopen,
  isEditable,
} from '../ui-utils';
import type { IssueStatus } from '../types';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Paperclip,
  MessageSquare,
  Clock,
  User,
  Building2,
  AlertTriangle,
  Package,
  Calendar,
  FileText,
  Edit2,
  Trash2,
  MoreHorizontal,
  Image,
  Download,
  Send as SendIcon,
} from 'lucide-react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --idp-bg-page: #f8f9fa;
    --idp-bg-card: #ffffff;
    --idp-bg-hover: #f1f3f4;
    --idp-border: #e5e7eb;
    --idp-border-light: #f0f0f0;
    --idp-text-primary: #111827;
    --idp-text-secondary: #6b7280;
    --idp-text-muted: #9ca3af;
    --idp-accent: #dc2626;
    --idp-accent-hover: #b91c1c;
  }
  
  .idp-page {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--idp-bg-page);
    min-height: 100vh;
  }
  
  .idp-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem;
  }
  
  /* Header */
  .idp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .idp-header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .idp-back-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: var(--idp-bg-card);
    border: 1px solid var(--idp-border);
    border-radius: 0.375rem;
    color: var(--idp-text-secondary);
    cursor: pointer;
  }
  
  .idp-back-btn:hover {
    background: var(--idp-bg-hover);
  }
  
  .idp-header-info h1 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--idp-text-primary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .idp-header-meta {
    font-size: 0.8125rem;
    color: var(--idp-text-secondary);
    margin-top: 0.25rem;
  }
  
  .idp-issue-no {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--idp-accent);
  }
  
  .idp-header-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .idp-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }
  
  .idp-btn-primary {
    background: var(--idp-accent);
    color: white;
  }
  
  .idp-btn-primary:hover { background: var(--idp-accent-hover); }
  
  .idp-btn-secondary {
    background: var(--idp-bg-card);
    color: var(--idp-text-primary);
    border: 1px solid var(--idp-border);
  }
  
  .idp-btn-secondary:hover { background: var(--idp-bg-hover); }
  
  .idp-btn-success {
    background: #10b981;
    color: white;
  }
  
  .idp-btn-success:hover { background: #059669; }
  
  /* Layout */
  .idp-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 1.5rem;
  }
  
  @media (max-width: 1024px) {
    .idp-layout { grid-template-columns: 1fr; }
  }
  
  /* Main Content */
  .idp-main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .idp-card {
    background: var(--idp-bg-card);
    border: 1px solid var(--idp-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .idp-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--idp-border);
    background: var(--idp-bg-page);
  }
  
  .idp-card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--idp-text-primary);
  }
  
  .idp-card-body {
    padding: 1rem;
  }
  
  /* Details Grid */
  .idp-details-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  @media (max-width: 640px) {
    .idp-details-grid { grid-template-columns: 1fr; }
  }
  
  .idp-detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .idp-detail-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--idp-text-muted);
  }
  
  .idp-detail-value {
    font-size: 0.875rem;
    color: var(--idp-text-primary);
    font-weight: 500;
  }
  
  /* Badges */
  .idp-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  /* Description */
  .idp-description {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--idp-text-primary);
    white-space: pre-wrap;
  }
  
  /* Sidebar */
  .idp-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  /* Status Actions */
  .idp-status-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .idp-status-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--idp-border);
    background: var(--idp-bg-card);
    color: var(--idp-text-primary);
    transition: all 0.15s ease;
  }
  
  .idp-status-btn:hover {
    background: var(--idp-bg-hover);
  }
  
  .idp-status-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .idp-status-btn.close {
    background: #10b981;
    color: white;
    border-color: #10b981;
  }
  
  .idp-status-btn.close:hover {
    background: #059669;
  }
  
  .idp-status-btn.reopen {
    background: #f59e0b;
    color: white;
    border-color: #f59e0b;
  }
  
  .idp-status-btn.reopen:hover {
    background: #d97706;
  }
  
  /* Timeline */
  .idp-timeline {
    padding: 0;
  }
  
  .idp-timeline-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--idp-border-light);
  }
  
  .idp-timeline-item:last-child { border-bottom: none; }
  
  .idp-timeline-icon {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--idp-bg-hover);
    color: var(--idp-text-secondary);
    font-size: 0.75rem;
  }
  
  .idp-timeline-content { flex: 1; min-width: 0; }
  
  .idp-timeline-text {
    font-size: 0.8125rem;
    color: var(--idp-text-primary);
  }
  
  .idp-timeline-meta {
    font-size: 0.6875rem;
    color: var(--idp-text-muted);
    margin-top: 0.125rem;
  }
  
  /* Comments */
  .idp-comments {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .idp-comment-input {
    display: flex;
    gap: 0.5rem;
  }
  
  .idp-comment-input textarea {
    flex: 1;
    padding: 0.625rem;
    border: 1px solid var(--idp-border);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-family: inherit;
    resize: none;
    min-height: 60px;
  }
  
  .idp-comment-input textarea:focus {
    outline: none;
    border-color: var(--idp-accent);
  }
  
  .idp-comment-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--idp-bg-page);
    border-radius: 0.375rem;
  }
  
  .idp-comment-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--idp-accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  
  .idp-comment-content { flex: 1; }
  
  .idp-comment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .idp-comment-author {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--idp-text-primary);
  }
  
  .idp-comment-time {
    font-size: 0.6875rem;
    color: var(--idp-text-muted);
  }
  
  .idp-comment-text {
    font-size: 0.8125rem;
    color: var(--idp-text-primary);
  }
  
  /* Attachments */
  .idp-attachments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }
  
  .idp-attachment-item {
    position: relative;
    aspect-ratio: 4/3;
    border-radius: 0.375rem;
    overflow: hidden;
    background: var(--idp-bg-hover);
    border: 1px solid var(--idp-border);
  }
  
  .idp-attachment-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .idp-attachment-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s;
  }
  
  .idp-attachment-item:hover .idp-attachment-overlay {
    opacity: 1;
  }
  
  .idp-attachment-overlay button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: white;
    border: none;
    border-radius: 0.25rem;
    color: var(--idp-text-primary);
    cursor: pointer;
  }
  
  .idp-add-attachment {
    aspect-ratio: 4/3;
    border: 2px dashed var(--idp-border);
    border-radius: 0.375rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--idp-text-muted);
    font-size: 0.75rem;
    transition: all 0.15s;
  }
  
  .idp-add-attachment:hover {
    border-color: var(--idp-accent);
    color: var(--idp-accent);
  }
  
  /* Loading */
  .idp-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: var(--idp-text-muted);
  }
  
  /* Empty */
  .idp-empty {
    padding: 2rem;
    text-align: center;
    color: var(--idp-text-muted);
  }
`;

export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: issue, isLoading } = useIssue(id || null);
  const { data: attachments } = useIssueAttachments(id || '');
  const { data: activityLogs } = useIssueActivityLogs(id || '');
  const { data: comments } = useIssueComments(id || '');
  
  const updateIssue = useUpdateIssue();
  const updateStatus = useUpdateIssueStatus();
  const assignIssue = useAssignIssue();
  const addComment = useAddIssueComment();
  const deleteIssue = useDeleteIssue();
  
  const [newComment, setNewComment] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeRemark, setCloseRemark] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenRemark, setReopenRemark] = useState('');
  
  if (isLoading) {
    return (
      <div className="idp-page">
        <style>{styles}</style>
        <div className="idp-loading">
          <Loader2 size={32} className="animate-spin" />
        </div>
      </div>
    );
  }
  
  if (!issue) {
    return (
      <div className="idp-page">
        <style>{styles}</style>
        <div className="idp-container">
          <div className="idp-empty">
            <AlertTriangle size={32} />
            <h3>Issue not found</h3>
            <p>The issue you're looking for doesn't exist or has been deleted.</p>
          </div>
        </div>
      </div>
    );
  }
  
  const severityStyles = getSeverityStyles(issue.severity);
  const statusStyles = getStatusStyles(issue.status);
  const overdue = isIssueOverdue(issue);
  
  const handleClose = async () => {
    await updateStatus.mutateAsync({
      id: issue.id,
      update: { status: 'closed', remark: closeRemark },
    });
    setShowCloseModal(false);
    setCloseRemark('');
  };
  
  const handleReopen = async () => {
    await updateStatus.mutateAsync({
      id: issue.id,
      update: { status: 'reopened', remark: reopenRemark },
    });
    setShowReopenModal(false);
    setReopenRemark('');
  };
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({
      issueId: issue.id,
      comment: newComment,
    });
    setNewComment('');
  };
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this issue?')) {
      await deleteIssue.mutateAsync(issue.id);
      navigate('/issues');
    }
  };
  
  return (
    <div className="idp-page">
      <style>{styles}</style>
      
      <div className="idp-container">
        {/* Header */}
        <div className="idp-header">
          <div className="idp-header-left">
            <button className="idp-back-btn" onClick={() => navigate('/issues')}>
              <ArrowLeft size={20} />
            </button>
            <div className="idp-header-info">
              <h1>
                <span className="idp-issue-no">{issue.issue_no}</span>
                {issue.title}
              </h1>
              <div className="idp-header-meta">
                Created {formatIssueDateTime(issue.created_at)} by {issue.reported_by_name || 'Unknown'}
                {issue.project?.project_name && ` • ${issue.project.project_name}`}
              </div>
            </div>
          </div>
          
          <div className="idp-header-actions">
            {isEditable(issue) && (
              <button className="idp-btn idp-btn-secondary">
                <Edit2 size={16} />
                Edit
              </button>
            )}
            <button className="idp-btn idp-btn-secondary" onClick={handleDelete}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
        
        {/* Layout */}
        <div className="idp-layout">
          {/* Main Content */}
          <div className="idp-main">
            {/* Details Card */}
            <div className="idp-card">
              <div className="idp-card-header">
                <div className="idp-card-title">Details</div>
              </div>
              <div className="idp-card-body">
                <div className="idp-details-grid">
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Issue Type</div>
                    <div className="idp-detail-value">{getIssueTypeLabel(issue.issue_type)}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">System</div>
                    <div className="idp-detail-value">{getSystemLabel(issue.system)}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Subsystem</div>
                    <div className="idp-detail-value">{issue.subsystem || '—'}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Severity</div>
                    <div className="idp-detail-value">
                      <span 
                        className="idp-badge"
                        style={{ 
                          background: severityStyles.bg, 
                          color: severityStyles.text,
                          border: `1px solid ${severityStyles.border}`
                        }}
                      >
                        {issue.severity}
                      </span>
                    </div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Priority</div>
                    <div className="idp-detail-value">{issue.priority || 'Normal'}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Status</div>
                    <div className="idp-detail-value">
                      <span 
                        className="idp-badge"
                        style={{ 
                          background: statusStyles.bg, 
                          color: statusStyles.text,
                          border: `1px solid ${statusStyles.border}`
                        }}
                      >
                        {issue.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Location</div>
                    <div className="idp-detail-value">{formatLocationPath(issue)}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Due Date</div>
                    <div className="idp-detail-value" style={{ color: overdue ? '#dc2626' : undefined }}>
                      {issue.due_date ? formatIssueDate(issue.due_date) : '—'}
                      {overdue && ' (Overdue)'}
                    </div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Equipment Tag</div>
                    <div className="idp-detail-value">{issue.equipment_tag || '—'}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Drawing Ref</div>
                    <div className="idp-detail-value">{issue.drawing_ref || '—'}</div>
                  </div>
                </div>
                
                {issue.description && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div className="idp-detail-label">Description</div>
                    <div className="idp-description">{issue.description}</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Attachments Card */}
            <div className="idp-card">
              <div className="idp-card-header">
                <div className="idp-card-title">Attachments</div>
              </div>
              <div className="idp-card-body">
                <div className="idp-attachments-grid">
                  {attachments && attachments.map(att => (
                    <div key={att.id} className="idp-attachment-item">
                      <img src={att.file_url} alt={att.caption || ''} />
                      <div className="idp-attachment-overlay">
                        <button><Download size={16} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="idp-add-attachment">
                    <Image size={24} />
                    <span>Add Photo</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Activity Timeline */}
            <div className="idp-card">
              <div className="idp-card-header">
                <div className="idp-card-title">Activity</div>
              </div>
              <div className="idp-card-body">
                <div className="idp-timeline">
                  {activityLogs && activityLogs.map(log => (
                    <div key={log.id} className="idp-timeline-item">
                      <div className="idp-timeline-icon">
                        {log.action === 'created' ? '+' : log.action === 'closed' ? '✓' : log.action === 'reopened' ? '!' : '·'}
                      </div>
                      <div className="idp-timeline-content">
                        <div className="idp-timeline-text">
                          {log.action.replace('_', ' ')} {log.done_by_name && `by ${log.done_by_name}`}
                        </div>
                        <div className="idp-timeline-meta">
                          {formatIssueDateTime(log.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="idp-sidebar">
            {/* Status Actions */}
            <div className="idp-card">
              <div className="idp-card-header">
                <div className="idp-card-title">Actions</div>
              </div>
              <div className="idp-card-body">
                <div className="idp-status-actions">
                  {canClose(issue) && (
                    <button 
                      className="idp-status-btn close"
                      onClick={() => setShowCloseModal(true)}
                    >
                      <CheckCircle size={18} />
                      Mark as Closed
                    </button>
                  )}
                  {canReopen(issue) && (
                    <button 
                      className="idp-status-btn reopen"
                      onClick={() => setShowReopenModal(true)}
                    >
                      <XCircle size={18} />
                      Reopen Issue
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Assignment */}
            <div className="idp-card">
              <div className="idp-card-header">
                <div className="idp-card-title">Assignment</div>
              </div>
              <div className="idp-card-body">
                <div className="idp-details-grid">
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Assigned To</div>
                    <div className="idp-detail-value">{issue.assigned_to_name || 'Unassigned'}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Subcontractor</div>
                    <div className="idp-detail-value">{issue.subcontractor?.name || '—'}</div>
                  </div>
                  <div className="idp-detail-item">
                    <div className="idp-detail-label">Client</div>
                    <div className="idp-detail-value">{issue.client?.client_name || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Comments */}
            <div className="idp-card">
              <div className="idp-card-header">
                <div className="idp-card-title">Comments</div>
              </div>
              <div className="idp-card-body">
                <div className="idp-comments">
                  <div className="idp-comment-input">
                    <textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                  </div>
                  <button 
                    className="idp-btn idp-btn-primary"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    <SendIcon size={14} />
                    Add Comment
                  </button>
                  
                  {comments && comments.map(comment => (
                    <div key={comment.id} className="idp-comment-item">
                      <div className="idp-comment-avatar">
                        {(comment.created_by_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="idp-comment-content">
                        <div className="idp-comment-header">
                          <span className="idp-comment-author">{comment.created_by_name || 'Unknown'}</span>
                          <span className="idp-comment-time">{formatIssueDateTime(comment.created_at)}</span>
                        </div>
                        <div className="idp-comment-text">{comment.comment}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}