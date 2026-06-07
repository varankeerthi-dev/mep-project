# Subcontractor Attendance Plan

## Phase 1 — Shipped

1. **Add `GENERAL` to WorkUnitType** — covers expansion/non-project work
2. **Subcontractor View: Daily Reports sub-tabs** — Logs / Attendance (with filters: date range, work type, category, status) / Summary

### Phase 1 changes

| File | Change |
|------|--------|
| `src/types/manpower.ts` | Added `GENERAL` to WorkUnitType, added `AttendanceSource` type, added `source`/`source_report_id` to interfaces, made `labour_category_id` nullable |
| `src/pages/ManpowerAttendance.tsx` | Added `General / Non-Project` to WorkUnit dropdown |
| `src/pages/Subcontractors.tsx` | Replaced flat dailylogs tab with 3 sub-tabs (Logs, Attendance with filters, Summary) |

## Phase 2 — Shipped

1. **Site Report manpower section** — real subcontractor picker + auto-creates `manpower_attendance` records
2. **ManpowerAttendanceList** — added Source column to show where records came from

### Phase 2 changes

| File | Change |
|------|--------|
| `src/pages/SiteReport.tsx` | Added subcontractor query; updated schema for `subcontractor_id`; added "Pick sub" dropdown in sub-contractor rows; auto-creates `manpower_attendance` records with `source='site_report'` on save/update; cleans up attendance records on update |
| `src/pages/ManpowerAttendanceList.tsx` | Added "Source" column header and data cell showing Site Report / Direct badges |
| `sql/attendance-phase2.sql` | Migration: add `subcontractor_id` to `sub_contractors`, add `source`/`source_report_id` to `manpower_attendance` |

### Database migration needed

```sql
ALTER TABLE sub_contractors ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES subcontractors(id);
ALTER TABLE manpower_attendance ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct';
ALTER TABLE manpower_attendance ADD COLUMN IF NOT EXISTS source_report_id UUID REFERENCES site_reports(id);
CREATE INDEX IF NOT EXISTS idx_manpower_attendance_source ON manpower_attendance(source);
CREATE INDEX IF NOT EXISTS idx_manpower_attendance_source_report ON manpower_attendance(source_report_id);
```

## Deferred
- Custom WorkUnitType settings page — 5 hardcoded types cover all scenarios
- Payment linkage — ship after 30 days of reliable attendance data
