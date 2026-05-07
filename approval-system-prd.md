# Approval System - Product Requirements Document (PRD)

## Executive Summary

This document outlines the requirements for a comprehensive enterprise-level approval system designed specifically for the Indian construction and MEP (Mechanical, Electrical, Plumbing) industry context. The system will streamline approval workflows for materials, site visits, quotations, invoices, purchase orders, material dispatch, work orders, and payment requests.

## 1. Business Context & Requirements

### 1.1 Industry Context
- **Target Industry**: Indian Construction/MEP sector
- **Regulatory Compliance**: GST compliance, Indian accounting standards, local tax regulations
- **Business Size**: Enterprise-level with multiple departments and hierarchical approval structures
- **Geographic Focus**: Pan-India operations with regional compliance requirements

### 1.2 Business Pain Points
- Manual approval processes causing delays in project execution
- Lack of centralized approval tracking and audit trails
- Inconsistent approval workflows across different document types
- Difficulty in managing multi-level approvals for high-value transactions
- Compliance and audit requirements for financial transactions

## 2. System Overview

### 2.1 Core Objectives
- Implement standardized approval workflows across all business processes
- Provide real-time approval status tracking and notifications
- Maintain comprehensive audit trails for compliance
- Enable quick one-click approvals/denials with proper documentation
- Integrate seamlessly with existing modules (Materials, Site Visits, Quotations, etc.)

### 2.2 Approval Categories
1. **Financial Approvals**
   - Purchase Orders (to vendors)
   - Invoices
   - Proforma Invoices
   - Payment Requests (Subcontractors & Vendors)
   - Expense Claims

2. **Operational Approvals**
   - Material Requests & Dispatch
   - Site Visit Reports
   - Work Orders
   - Quotations

## 3. Phase-wise Implementation Plan

### Phase 1: Core Approval Infrastructure (Weeks 1-3)

#### 3.1 Database Schema
```sql
-- Approvals Master Table
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_type VARCHAR(50) NOT NULL, -- PO, WO, QUOTE, INVOICE, etc.
    reference_id UUID NOT NULL, -- Reference to original document
    reference_type VARCHAR(50) NOT NULL, -- Table name of reference
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'INR',
    requested_by UUID REFERENCES users(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_level INTEGER DEFAULT 1,
    max_levels INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, HOLD
    priority VARCHAR(10) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    organisation_id UUID REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval Workflow Levels
CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_type VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL,
    min_amount DECIMAL(15,2),
    max_amount DECIMAL(15,2),
    approver_role VARCHAR(50) NOT NULL,
    approver_id UUID REFERENCES users(id), -- Specific approver if fixed
    is_active BOOLEAN DEFAULT true,
    organisation_id UUID REFERENCES organisations(id)
);

-- Approval Actions Log
CREATE TABLE approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID REFERENCES approvals(id),
    action VARCHAR(20) NOT NULL, -- APPROVED, REJECTED, HOLD, FORWARDED
    approver_id UUID REFERENCES users(id),
    approver_role VARCHAR(50),
    comments TEXT,
    action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    organisation_id UUID REFERENCES organisations(id)
);

-- Approval Notifications
CREATE TABLE approval_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID REFERENCES approvals(id),
    user_id UUID REFERENCES users(id),
    notification_type VARCHAR(20) NOT NULL, -- EMAIL, SMS, IN_APP
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    organisation_id UUID REFERENCES organisations(id)
);
```

#### 3.2 Backend API Structure
```typescript
// src/approvals/api.ts
export interface ApprovalRequest {
  approval_type: string;
  reference_id: string;
  reference_type: string;
  title: string;
  description?: string;
  amount?: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface ApprovalAction {
  action: 'APPROVED' | 'REJECTED' | 'HOLD' | 'FORWARDED';
  comments?: string;
  forward_to?: string;
}

// Core API Functions
export const createApprovalRequest = (data: ApprovalRequest) => Promise<Approval>;
export const getApprovalsForUser = (userId: string, filters?: ApprovalFilters) => Promise<Approval[]>;
export const processApproval = (approvalId: string, action: ApprovalAction) => Promise<void>;
export const getApprovalHistory = (approvalId: string) => Promise<ApprovalAction[]>;
export const getApprovalStats = (userId: string) => Promise<ApprovalStats>;
```

### Phase 2: Approval Dashboard & UI (Weeks 4-5)

#### 3.3 Main Approval Dashboard Layout
```
src/pages/Approvals.tsx
├── Header Section (py-5)
│   ├── Title: "Approvals"
│   ├── Search Bar (Global)
│   ├── Filter Dropdown (Approval Type, Status, Priority)
│   └── New Approval Request Button
├── Stats Cards (py-3)
│   ├── Pending Approvals (Count)
│   ├── Approved Today (Count)
│   ├── Rejected This Week (Count)
│   └── On Hold (Count)
├── Approval Table (Excel-style, py-4)
│   ├── Columns: Date, Approval Type, Description, Reference No, Amount, Status, Actions
│   ├── Color-coded approval types
│   ├── One-click action buttons
│   └── Pagination
└── Quick Actions Section
    ├── Bulk Approve Selected
    ├── Bulk Reject Selected
    └── Export to Excel
```

#### 3.4 UI Design Specifications
- **Container Style**: `radial-none` (no rounded corners)
- **Padding**: All text/containers with `py-3` (12px top & bottom)
- **Table Style**: Excel-inspired with clean borders and hover states
- **Color Scheme**: 
  - PO: Blue (#3B82F6)
  - Work Order: Green (#10B981)
  - Proforma: Purple (#8B5CF6)
  - Invoice: Orange (#F59E0B)
  - Payment Request: Red (#EF4444)

#### 3.5 Approval Table Component
```typescript
// src/components/ApprovalTable.tsx
interface ApprovalTableProps {
  approvals: Approval[];
  onAction: (approvalId: string, action: string) => void;
  loading?: boolean;
}

const ApprovalTable: React.FC<ApprovalTableProps> = ({
  approvals,
  onAction,
  loading = false
}) => {
  return (
    <div className="w-full bg-white border border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approval Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Reference No
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {approvals.map((approval) => (
            <ApprovalRow 
              key={approval.id} 
              approval={approval} 
              onAction={onAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Phase 3: Integration with Existing Modules (Weeks 6-7)

#### 3.6 Module Integration Points

**Purchase Orders Integration**
```typescript
// src/purchase/api.ts enhancements
export const createPurchaseOrder = async (poData: PurchaseOrderData) => {
  // Create PO
  const po = await supabase.from('purchase_orders').insert(poData);
  
  // Auto-create approval request if amount exceeds threshold
  if (poData.total_amount > APPROVAL_THRESHOLD) {
    await createApprovalRequest({
      approval_type: 'PURCHASE_ORDER',
      reference_id: po.data[0].id,
      reference_type: 'purchase_orders',
      title: `PO Request - ${poData.vendor_name}`,
      description: `Purchase order for ${poData.items.length} items`,
      amount: poData.total_amount,
      priority: poData.total_amount > 100000 ? 'HIGH' : 'NORMAL'
    });
  }
  
  return po;
};
```

**Work Orders Integration**
```typescript
// src/subcontractors/api.ts enhancements
export const createWorkOrder = async (woData: WorkOrderData) => {
  const workOrder = await supabase.from('work_orders').insert(woData);
  
  await createApprovalRequest({
    approval_type: 'WORK_ORDER',
    reference_id: workOrder.data[0].id,
    reference_type: 'work_orders',
    title: `Work Order - ${woData.subcontractor_name}`,
    description: `Work order for ${woData.project_name}`,
    amount: woData.total_amount,
    priority: woData.is_urgent ? 'URGENT' : 'NORMAL'
  });
  
  return workOrder;
};
```

#### 3.7 PDF Enhancement for Approvals
```typescript
// src/utils/pdf-generator.ts
export const generateApprovedPDF = async (documentData: any, approvalData: Approval) => {
  const pdfDoc = await PDFDocument.create();
  
  // Add approval section to PDF
  const approvalSection = `
    APPROVAL DETAILS
    ================
    Approved By: ${approvalData.approved_by_name}
    Approved At: ${format(approvalData.approved_at, 'dd MMM yyyy HH:mm')}
    Approval ID: ${approvalData.id}
    Comments: ${approvalData.comments || 'N/A'}
  `;
  
  // Add approval section to existing PDF
  await addApprovalSectionToPDF(pdfDoc, approvalSection);
  
  return pdfDoc;
};
```

### Phase 4: Advanced Features (Weeks 8-9)

#### 3.8 Multi-level Approval Workflows
```typescript
// src/approvals/workflow-engine.ts
export class ApprovalWorkflowEngine {
  async processApproval(approvalId: string, action: ApprovalAction) {
    const approval = await this.getApproval(approvalId);
    const workflow = await this.getWorkflow(approval.approval_type, approval.amount);
    
    // Log the action
    await this.logApprovalAction(approvalId, action);
    
    if (action.action === 'APPROVED') {
      if (approval.current_level < workflow.max_levels) {
        // Move to next level
        await this.moveToNextLevel(approvalId);
        await this.notifyNextApprover(approvalId);
      } else {
        // Final approval
        await this.finalizeApproval(approvalId);
        await this.triggerPostApprovalActions(approval);
      }
    } else if (action.action === 'REJECTED') {
      await this.rejectApproval(approvalId);
      await this.notifyRequester(approvalId, 'REJECTED');
    }
  }
}
```

#### 3.9 Notification System
```typescript
// src/approvals/notifications.ts
export const sendApprovalNotifications = async (approvalId: string) => {
  const approval = await getApproval(approvalId);
  const approvers = await getApprovers(approval);
  
  for (const approver of approvers) {
    // Email notification
    await emailService.send({
      to: approver.email,
      subject: `Approval Required: ${approval.title}`,
      template: 'approval-request',
      data: { approval, approver }
    });
    
    // In-app notification
    await createNotification({
      user_id: approver.id,
      title: 'Approval Required',
      message: approval.title,
      action_url: `/approvals/${approvalId}`,
      type: 'APPROVAL_REQUIRED'
    });
    
    // SMS for urgent approvals
    if (approval.priority === 'URGENT') {
      await smsService.send({
        to: approver.phone,
        message: `URGENT: Approval required for ${approval.title}`
      });
    }
  }
};
```

### Phase 5: Reporting & Analytics (Week 10)

#### 3.10 Approval Analytics Dashboard
```typescript
// src/pages/ApprovalAnalytics.tsx
interface ApprovalAnalytics {
  totalApprovals: number;
  pendingApprovals: number;
  averageApprovalTime: number;
  approvalByType: Record<string, number>;
  approvalByDepartment: Record<string, number>;
  monthlyTrends: MonthlyTrend[];
}

const ApprovalAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<ApprovalAnalytics>();
  
  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Approvals" value={analytics?.totalApprovals} />
        <StatCard title="Pending" value={analytics?.pendingApprovals} />
        <StatCard title="Avg. Time" value={`${analytics?.averageApprovalTime}h`} />
        <StatCard title="Today's Approvals" value={analytics?.todayApprovals} />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <ApprovalTypeChart data={analytics?.approvalByType} />
        <MonthlyTrendChart data={analytics?.monthlyTrends} />
      </div>
    </div>
  );
};
```

## 4. Technical Architecture

### 4.1 Frontend Architecture
- **Framework**: React with TypeScript
- **UI Components**: Shadcn/ui with custom styling
- **State Management**: React Query for server state, useState for local state
- **Routing**: React Router v6
- **Styling**: Tailwind CSS with custom design tokens

### 4.2 Backend Architecture
- **Database**: PostgreSQL with Supabase
- **API**: RESTful APIs with proper error handling
- **Authentication**: Supabase Auth with role-based access
- **Real-time**: Supabase Realtime for live updates

### 4.3 Integration Points
- **PDF Generation**: Existing PDF generation system enhanced with approval stamps
- **Email Service**: Integration with existing email notification system
- **File Storage**: Supabase Storage for approval documents
- **Audit Logging**: Comprehensive audit trail for compliance

## 5. User Experience Design

### 5.1 Approval Dashboard Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Approvals                                              [🔍] [⚙️] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │  12 │ │  45 │ │   3 │ │   8 │ │  23 │ │  15 │ │   2 │    │
│ │Pend │ │ App │ │ Rej │ │ Hold│ │ PO  │ │ WO  │ │ Inv │    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
├─────────────────────────────────────────────────────────────┤
│ Date    | Type    | Description           | Ref    | Amt │
│─────────────────────────────────────────────────────────────│
│ 05/05/26| [PO]    | Electrical Materials  | PO-001 |₹1.2L│ [✓][✗][⏸]│
│ 05/05/26| [WO]    | HVAC Installation     | WO-023 |₹85K │ [✓][✗][⏸]│
│ 05/05/26| [INV]   | Client Invoice        | INV-045|₹2.1L│ [✓][✗][⏸]│
└─────────────────────────────────────────────────────────────┘
```

### 5.2 One-Click Approval Actions
- **Approve**: Single click with optional comments
- **Reject**: Single click with mandatory comments
- **Hold**: Single click with optional hold reason
- **Forward**: Forward to another approver with comments

### 5.3 Mobile Responsiveness
- Touch-friendly action buttons
- Swipe gestures for quick actions
- Mobile-optimized table views
- Push notifications for urgent approvals

## 6. Security & Compliance

### 6.1 Role-Based Access Control
```typescript
enum ApprovalRole {
  REQUESTER = 'REQUESTER',
  APPROVER_LEVEL_1 = 'APPROVER_LEVEL_1',
  APPROVER_LEVEL_2 = 'APPROVER_LEVEL_2',
  APPROVER_LEVEL_3 = 'APPROVER_LEVEL_3',
  ADMIN = 'ADMIN'
}

const approvalPermissions = {
  [ApprovalRole.REQUESTER]: ['create', 'view_own'],
  [ApprovalRole.APPROVER_LEVEL_1]: ['approve_level_1', 'view_assigned'],
  [ApprovalRole.APPROVER_LEVEL_2]: ['approve_level_2', 'view_assigned'],
  [ApprovalRole.APPROVER_LEVEL_3]: ['approve_level_3', 'view_assigned'],
  [ApprovalRole.ADMIN]: ['*']
};
```

### 6.2 Audit Trail Requirements
- All approval actions must be logged with timestamps
- IP address and user agent capture for security
- Immutable audit logs (no deletion allowed)
- Regular audit report generation

### 6.3 Data Privacy
- GDPR-like data protection principles
- Role-based data access
- Secure data transmission (HTTPS)
- Regular security audits

## 7. Performance Requirements

### 7.1 Response Time Targets
- **Approval Dashboard**: < 2 seconds load time
- **Approval Actions**: < 1 second response time
- **Search/Filter**: < 1.5 seconds response time
- **PDF Generation**: < 5 seconds for standard documents

### 7.2 Scalability Requirements
- Support 1000+ concurrent users
- Handle 10,000+ approvals per day
- Real-time updates for active approvals
- Efficient database indexing for quick queries

## 8. Testing Strategy

### 8.1 Unit Testing
- API endpoint testing
- Component testing with React Testing Library
- Business logic validation
- Edge case handling

### 8.2 Integration Testing
- End-to-end approval workflows
- Database transaction integrity
- Third-party service integrations
- PDF generation accuracy

### 8.3 User Acceptance Testing
- Role-based testing with actual users
- Performance testing under load
- Mobile device testing
- Browser compatibility testing

## 9. Deployment & Rollout

### 9.1 Phased Rollout Plan
1. **Internal Beta** (Week 11): Core team testing
2. **Pilot Group** (Week 12): Selected power users
3. **Department Rollout** (Weeks 13-14): Department by department
4. **Full Launch** (Week 15): Complete organization rollout

### 9.2 Training & Documentation
- User training manuals
- Video tutorials for common workflows
- Admin documentation for configuration
- FAQ and troubleshooting guides

## 10. Success Metrics

### 10.1 Key Performance Indicators
- **Approval Cycle Time**: Reduce by 60%
- **User Adoption**: 90% of target users using the system
- **Processing Time**: 80% of approvals processed within SLA
- **Error Reduction**: 95% reduction in approval errors

### 10.2 Business Impact Metrics
- **Cost Savings**: Reduced manual processing costs
- **Compliance**: 100% audit trail compliance
- **Productivity**: 40% improvement in approval efficiency
- **User Satisfaction**: 85%+ user satisfaction score

## 11. Future Enhancements

### 11.1 Advanced Features (Phase 2)
- AI-powered approval recommendations
- Predictive approval timing
- Advanced analytics and reporting
- Integration with external ERP systems

### 11.2 Mobile Application
- Native mobile app for iOS and Android
- Push notifications for urgent approvals
- Offline approval capabilities
- Biometric authentication for approvals

### 11.3 Integration Roadmap
- Tally/ERP integration
- Banking integration for payment approvals
- Vendor portal integration
- Client portal for invoice approvals

---

## Appendices

### Appendix A: Approval Type Color Codes
- **Purchase Orders**: #3B82F6 (Blue)
- **Work Orders**: #10B981 (Green)
- **Proforma Invoices**: #8B5CF6 (Purple)
- **Invoices**: #F59E0B (Orange)
- **Payment Requests**: #EF4444 (Red)
- **Material Dispatch**: #06B6D4 (Cyan)
- **Site Visit Reports**: #84CC16 (Lime)

### Appendix B: Database Indexes
```sql
-- Performance optimization indexes
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_type ON approvals(approval_type);
CREATE INDEX idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX idx_approval_actions_approval_id ON approval_actions(approval_id);
CREATE INDEX idx_approval_workflows_type_amount ON approval_workflows(approval_type, min_amount, max_amount);
```

### Appendix C: API Response Formats
```typescript
// Standard API Response Format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
    timestamp: string;
  };
}
```

---

**Document Version**: 1.0  
**Last Updated**: May 5, 2026  
**Next Review**: May 19, 2026  
**Document Owner**: Product Team
