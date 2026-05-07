# Approval System - Setup Guide

## Overview
The approval system has been successfully implemented with all features from the PRD. This guide will help you set up and configure the system.

## Files Created

### Core System Files
- `src/database-approvals.sql` - Database schema and migration
- `src/types/approvals.ts` - TypeScript interfaces and configurations
- `src/approvals/api.ts` - Core API endpoints
- `src/approvals/workflow-engine.ts` - Workflow processing engine
- `src/approvals/notifications.ts` - Notification system
- `src/approvals/integration.ts` - Module integration hooks
- `src/approvals/pdf-enhancements.ts` - PDF approval stamps

### UI Components
- `src/pages/Approvals.tsx` - Main approval dashboard
- `src/components/ApprovalTable.tsx` - Excel-style approval table

### Updated Files
- `src/components/Sidebar.tsx` - Added Approvals menu item

## Setup Instructions

### 1. Database Setup
Run the database migration in Supabase SQL Editor:
```sql
-- Execute the contents of src/database-approvals.sql
```

### 2. Install Dependencies
The system uses these additional packages:
```bash
npm install pdf-lib date-fns
```

### 3. Configure Approval Workflows
The system includes default workflow configurations. You can customize them by updating the `approval_workflows` table:

```sql
-- Example: Configure 3-level approval for purchase orders
INSERT INTO approval_workflows (approval_type, level, min_amount, max_amount, approver_role, organisation_id) VALUES
('PURCHASE_ORDER', 1, 0, 50000, 'PROJECT_MANAGER', 'your-org-id'),
('PURCHASE_ORDER', 2, 50001, 200000, 'GENERAL_MANAGER', 'your-org-id'),
('PURCHASE_ORDER', 3, 200001, NULL, 'DIRECTOR', 'your-org-id');
```

### 4. Integration with Existing Modules
Use the integration hooks in your existing modules:

#### Purchase Orders
```typescript
import { ApprovalIntegration } from './approvals/integration';

// When creating a PO
const result = await ApprovalIntegration.createPurchaseOrderApproval(
  poId, 
  vendorName, 
  totalAmount, 
  'NORMAL'
);
```

#### Work Orders
```typescript
const result = await ApprovalIntegration.createWorkOrderApproval(
  workOrderId, 
  subcontractorName, 
  projectName, 
  totalAmount
);
```

#### Invoices
```typescript
const result = await ApprovalIntegration.createInvoiceApproval(
  invoiceId, 
  clientName, 
  invoiceNumber, 
  totalAmount
);
```

## Features Implemented

### ✅ Core Features
- [x] Multi-level approval workflows
- [x] Excel-style approval table with filtering
- [x] One-click approve/reject/hold actions
- [x] Real-time approval status tracking
- [x] Comprehensive audit trail
- [x] Role-based access control

### ✅ Approval Types
- [x] Purchase Orders (Blue)
- [x] Work Orders (Green)
- [x] Quotations (Purple)
- [x] Invoices (Orange)
- [x] Proforma Invoices (Purple)
- [x] Payment Requests (Red)
- [x] Material Dispatch (Cyan)
- [x] Site Visit Reports (Lime)
- [x] Expense Claims (Orange)

### ✅ UI/UX Features
- [x] Radial-none containers (no rounded corners)
- [x] Consistent py-3 (12px) padding
- [x] Excel-inspired table design
- [x] Color-coded approval types
- [x] Advanced filtering system
- [x] Bulk approval actions
- [x] Approval details modal

### ✅ Enterprise Features
- [x] Organisation-based data isolation
- [x] Multi-level approval workflows
- [x] Comprehensive notifications (email, SMS, in-app)
- [x] PDF approval stamps and watermarks
- [x] Approval certificates
- [x] Detailed audit trails
- [x] Indian context (₹ formatting, GST compliance)

### ✅ Integration Points
- [x] Purchase Order integration
- [x] Work Order integration
- [x] Invoice integration
- [x] Quotation integration
- [x] Payment Request integration
- [x] Material Dispatch integration

## Usage Instructions

### Accessing the Approval System
1. Navigate to the "Approvals" menu item in the sidebar
2. The approval dashboard will show pending approvals for your role
3. Use filters to narrow down approvals by type, status, priority, or date range

### Processing Approvals
1. Review the approval details in the table
2. Add comments if needed
3. Click the appropriate action button:
   - ✓ Approve (Green)
   - ✗ Reject (Red)
   - ⏸ Hold (Yellow)
   - → Forward (Purple)

### Creating Approval Requests
Approval requests are automatically created when:
- Purchase orders exceed configured thresholds
- Work orders exceed configured thresholds
- Invoices require approval
- Payment requests are created
- Material dispatches need approval

## Configuration Options

### Approval Thresholds
Configure amount-based approval thresholds in the `approval_workflows` table:

```sql
-- No approval needed up to ₹10,000
-- Level 1 approval for ₹10,001 - ₹50,000
-- Level 2 approval for ₹50,001 - ₹200,000
-- Level 3 approval above ₹200,000
```

### Notification Settings
The system supports:
- In-app notifications (always enabled)
- Email notifications (requires email service setup)
- SMS notifications (for urgent approvals only)

### PDF Enhancements
Approved documents automatically include:
- Approval section with approver details
- Approval history timeline
- Approval certificate
- Watermark indicating approval status

## Security Features

### Row Level Security (RLS)
All approval tables are secured with RLS policies:
- Users can only view approvals for their organisation
- Approvers can only process approvals assigned to their role
- Complete audit trail with IP and user agent logging

### Data Privacy
- Organisation-based data isolation
- Immutable audit logs
- Secure approval workflows
- No deletion of approval records

## Performance Optimizations

### Database Indexes
Optimized indexes for:
- Approval status lookups
- Approval type filtering
- Date-based queries
- User-based filtering

### Caching
- Approval statistics cached in database view
- Efficient query patterns
- Minimal API calls

## Troubleshooting

### Common Issues

#### Approvals not showing
1. Check if user has approver role configured
2. Verify workflow configuration for approval type
3. Ensure user belongs to correct organisation

#### Notifications not sending
1. Check email/SMS service configuration
2. Verify notification templates
3. Check user notification preferences

#### PDF generation issues
1. Ensure pdf-lib is installed
2. Check file permissions
3. Verify PDF document format

### Debug Mode
Enable debug logging by setting:
```typescript
localStorage.setItem('approval-debug', 'true');
```

## Next Steps

### Phase 2 Enhancements (Future)
- AI-powered approval recommendations
- Mobile app integration
- Advanced analytics dashboard
- External ERP integration

### Customization
- Custom approval workflows
- Additional approval types
- Custom notification templates
- Branded PDF certificates

## Support

For technical support:
1. Check browser console for errors
2. Review Supabase logs
3. Verify database connections
4. Check user permissions

## Documentation

- API Documentation: See `src/approvals/api.ts`
- Workflow Engine: See `src/approvals/workflow-engine.ts`
- Integration Guide: See `src/approvals/integration.ts`
- UI Components: See `src/components/ApprovalTable.tsx`

---

**System Status: ✅ Fully Implemented and Ready for Production**

The approval system is now complete and ready for use. All features from the PRD have been implemented according to the specifications for the Indian MEP/Construction industry context.
