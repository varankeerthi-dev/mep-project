# Conversion Workflow Enhancement PRD

**Document Version:** 1.0  
**Created:** May 5, 2026  
**Author:** System Analysis  
**Status:** Ready for Development  

## Executive Summary

This PRD addresses critical issues in the document conversion system that currently cause data loss, inconsistent behavior, and potential compliance violations. The fixes will standardize all conversion workflows while preserving existing functionality and improving data integrity.

## Current Issues Identified

### 1. Critical Issues (P0)
- **Dual Proforma→Invoice Implementations:** Two different conversion paths causing inconsistent behavior
- **Data Loss in Quotation→Proforma:** Discount information always set to 0
- **Client Resolution Failures:** DC conversions fail when client_id is null
- **Missing DC Duplication:** Inconsistent user experience across document types

### 2. High Priority Issues (P1)
- **Inconsistent Meta Data Handling:** Different structures across conversion types
- **No Transaction Safety:** Partial conversions can leave orphaned records
- **Tax Calculation Variations:** Different tax handling across conversions

### 3. Medium Priority Issues (P2)
- **Frontend Status Updates:** Race conditions in document status changes
- **Number Generation Race Conditions:** Potential duplicate document numbers

## Proposed Solution Architecture

### Phase 1: Unified Conversion Engine

#### 1.1 Centralized Conversion Service
**Location:** `src/conversions/unified-conversion-service.ts`

```typescript
interface UnifiedConversionConfig {
  sourceType: 'quotation' | 'proforma' | 'delivery_challan';
  targetType: 'quotation' | 'proforma' | 'invoice';
  preserveMetadata: boolean;
  validateTaxes: boolean;
  rollbackOnError: boolean;
}

class UnifiedConversionService {
  async convertDocument(config: UnifiedConversionConfig): Promise<ConversionResult>
  async validateConversion(config: UnifiedConversionConfig): Promise<ValidationResult>
  async rollbackConversion(conversionId: string): Promise<void>
}
```

#### 1.2 Standardized Data Mappers
**Location:** `src/conversions/mappers/`

- `quotation-to-proforma.mapper.ts` - Enhanced with discount preservation
- `proforma-to-invoice.mapper.ts` - Consolidated implementation
- `dc-to-quotation.mapper.ts` - Enhanced with HSN preservation
- `dc-to-proforma.mapper.ts` - Enhanced with client resolution

### Phase 2: Data Integrity Enhancements

#### 2.1 Metadata Preservation Standard
All conversions will preserve:
- Source document ID in `meta_json.source_document_id`
- Source item IDs in `meta_json.source_item_id`
- Original tax calculations in `meta_json.original_tax_data`
- Conversion timestamp in `meta_json.conversion_timestamp`
- User who performed conversion in `meta_json.converted_by`

#### 2.2 Discount Data Preservation
**Fix Location:** `src/conversions/mappers/quotation-to-proforma.mapper.ts`

```typescript
// Current (BROKEN):
discount_percent: 0,
discount_amount: 0,

// Fixed:
discount_percent: item.discount_percent || 0,
discount_amount: item.discount_amount || 0,
```

#### 2.3 Client Resolution Enhancement
**Fix Location:** `src/conversions/utils/client-resolver.ts`

```typescript
interface ClientResolutionStrategy {
  resolveFromName(clientName: string, orgId: string): Promise<string>
  resolveFromProject(projectId: string, orgId: string): Promise<string>
  fallbackToManualSelection(orgId: string): Promise<Client[]>
}
```

### Phase 3: Transaction Safety

#### 3.1 Database Transaction Wrapper
**Location:** `src/conversions/transaction-manager.ts`

```typescript
class ConversionTransactionManager {
  async executeConversion<T>(
    conversionFn: () => Promise<T>,
    rollbackFn: () => Promise<void>
  ): Promise<T>
  
  async createConversionSession(): Promise<string>
  async commitConversion(sessionId: string): Promise<void>
  async rollbackConversion(sessionId: string): Promise<void>
}
```

#### 3.2 Atomic Document Number Generation
**Fix Location:** `src/conversions/number-generator.ts`

```typescript
class AtomicNumberGenerator {
  async reserveNumber(documentType: string, orgId: string): Promise<string>
  async confirmNumber(reservationId: string): Promise<void>
  async releaseReservation(reservationId: string): Promise<void>
}
```

### Phase 4: Missing Functionality Implementation

#### 4.1 Delivery Challan Duplication
**New Location:** `src/delivery-challans/api.ts`

```typescript
export async function duplicateDeliveryChallan(
  id: string,
  organisationId: string,
  options?: { newClientId?: string, newDate?: string }
): Promise<DeliveryChallanWithRelations>
```

#### 4.2 Enhanced Duplicate Workflows
**Enhancement Location:** Existing duplicate functions

- Add source tracking for all duplicates
- Implement revision history for duplicates
- Add duplicate metadata to track origin

### Phase 5: Status Management Standardization

#### 5.1 Backend Status Update Service
**New Location:** `src/conversions/status-manager.ts`

```typescript
class ConversionStatusManager {
  async updateSourceDocumentStatus(
    conversionType: ConversionType,
    sourceId: string,
    targetId: string,
    orgId: string
  ): Promise<void>
  
  async validateStatusUpdate(
    documentType: string,
    documentId: string,
    newStatus: string
  ): Promise<boolean>
}
```

## Implementation Plan

### Sprint 1: Critical Fixes (Week 1-2)
1. **Consolidate Proforma→Invoice Conversion**
   - Remove duplicate implementation in `proforma-invoices/api.ts`
   - Enhance unified conversion in `conversions/api.ts`
   - Add comprehensive test coverage

2. **Fix Quotation→Proforma Data Loss**
   - Preserve discount information during conversion
   - Add validation to ensure no data loss
   - Update frontend to display preserved discounts

3. **Implement Client Resolution**
   - Create client resolution utility
   - Update DC conversion mappings
   - Add fallback mechanisms

### Sprint 2: Data Integrity (Week 3-4)
1. **Standardize Metadata Handling**
   - Define unified metadata schema
   - Update all conversion mappers
   - Add metadata validation

2. **Implement Transaction Safety**
   - Create transaction manager
   - Add rollback mechanisms
   - Update conversion functions to use transactions

3. **Fix Number Generation**
   - Implement atomic number reservation
   - Update all document creation flows
   - Add number conflict detection

### Sprint 3: Missing Features (Week 5-6)
1. **Add DC Duplication**
   - Implement duplicate function
   - Add UI components
   - Integrate with existing patterns

2. **Enhance Status Management**
   - Move status updates to backend
   - Add status validation
   - Implement status change audit trail

3. **Add Conversion Audit Trail**
   - Track all conversions
   - Add conversion history UI
   - Implement conversion analytics

## Technical Specifications

### Data Schema Changes

#### New Tables
```sql
-- Conversion audit trail
CREATE TABLE conversion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  conversion_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Number reservations
CREATE TABLE number_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  reserved_number TEXT NOT NULL,
  organisation_id UUID REFERENCES organisations(id),
  reserved_by UUID REFERENCES auth.users(id),
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(document_type, reserved_number, organisation_id)
);
```

#### Enhanced Columns
```sql
-- Add to all document item tables
ALTER TABLE quotation_items ADD COLUMN conversion_metadata JSONB DEFAULT '{}';
ALTER TABLE proforma_items ADD COLUMN conversion_metadata JSONB DEFAULT '{}';
ALTER TABLE invoice_items ADD COLUMN conversion_metadata JSONB DEFAULT '{}';
ALTER TABLE delivery_challan_items ADD COLUMN conversion_metadata JSONB DEFAULT '{}';
```

### API Endpoints

#### New Conversion Endpoints
```typescript
// Unified conversion service
POST /api/conversions/convert
GET /api/conversions/validate/:type/:sourceId
POST /api/conversions/rollback/:conversionId

// Number management
POST /api/conversions/reserve-number
POST /api/conversions/confirm-number
DELETE /api/conversions/release-number

// Audit trail
GET /api/conversions/history/:orgId
GET /api/conversions/audit/:conversionId
```

#### Enhanced Existing Endpoints
```typescript
// Enhanced duplicate functions
POST /api/proformas/:id/duplicate
POST /api/delivery-challans/:id/duplicate
POST /api/quotations/:id/duplicate

// Status management
PUT /api/documents/:type/:id/status
GET /api/documents/:type/:id/status-history
```

### Frontend Changes

#### Conversion UI Enhancements
1. **Conversion Confirmation Modal**
   - Show data mapping preview
   - Highlight any data transformations
   - Allow user to adjust mappings

2. **Conversion Progress Indicator**
   - Show conversion steps
   - Handle long-running conversions
   - Provide cancellation option

3. **Conversion History Panel**
   - Display conversion audit trail
   - Show reverse conversion options
   - Filter by date/type/user

#### Duplicate UI Standardization
1. **Unified Duplicate Dialog**
   - Consistent across all document types
   - Support client/date changes
   - Show preview before confirmation

## Testing Strategy

### Unit Tests
- All conversion mappers: 100% coverage
- Transaction manager: 100% coverage
- Number generator: 100% coverage
- Client resolver: 100% coverage

### Integration Tests
- End-to-end conversion workflows
- Transaction rollback scenarios
- Concurrent conversion attempts
- Number reservation conflicts

### Performance Tests
- Large document conversions (>1000 items)
- Concurrent conversion load testing
- Database transaction performance

### User Acceptance Tests
- Conversion accuracy validation
- UI usability testing
- Error handling validation
- Rollback scenario testing

## Success Metrics

### Technical Metrics
- **Zero Data Loss:** All conversions preserve 100% of source data
- **Conversion Success Rate:** >99.5% successful conversions
- **Rollback Success Rate:** 100% successful rollbacks on failure
- **Number Conflict Rate:** <0.1% duplicate numbers

### Business Metrics
- **User Satisfaction:** >90% satisfaction with conversion reliability
- **Support Tickets:** 80% reduction in conversion-related tickets
- **Data Accuracy:** 100% audit trail completeness
- **Conversion Speed:** <2 seconds for typical conversions

## Risk Assessment

### Technical Risks
- **Database Migration Complexity:** Medium - Requires careful schema changes
- **Performance Impact:** Low - Well-optimized queries
- **Backward Compatibility:** Low - Maintains existing APIs

### Business Risks
- **User Training:** Medium - New workflows require user education
- **Data Migration:** Low - Existing data remains unchanged
- **Feature Availability:** Low - No functionality removed

## Rollout Plan

### Phase 1: Backend Infrastructure (Week 1-2)
- Deploy new database schema
- Implement unified conversion service
- Add comprehensive testing

### Phase 2: API Integration (Week 3-4)
- Update existing endpoints
- Add new conversion endpoints
- Implement transaction safety

### Phase 3: Frontend Updates (Week 5-6)
- Update conversion UI components
- Add new duplicate workflows
- Implement status management

### Phase 4: Testing & QA (Week 7-8)
- Comprehensive testing
- Performance optimization
- User acceptance testing

### Phase 5: Deployment (Week 9)
- Gradual rollout with feature flags
- Monitor performance metrics
- Collect user feedback

## Dependencies

### Technical Dependencies
- Supabase database access
- Existing document schemas
- Current authentication system

### External Dependencies
- PDF generation libraries (existing)
- Email notification system (existing)
- File storage system (existing)

## Conclusion

This PRD provides a comprehensive solution to the conversion workflow issues while preserving all existing functionality. The phased approach ensures minimal disruption while delivering significant improvements in data integrity, user experience, and system reliability.

The unified conversion architecture will serve as a foundation for future document type additions and provide a robust, scalable solution for the organization's document management needs.
