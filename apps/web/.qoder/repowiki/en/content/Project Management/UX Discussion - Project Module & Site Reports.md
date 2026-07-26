# UX Discussion — Project Module & Site Reports

**Date:** 2026-07-26
**Attendees:** UX Engineer, MEP Manager, Project Engineer, Site Engineer
**Context:** Coffee shop discussion on UX pain points, missing features, and enhancements for the Project Management module and Site Reports.

---

## Table of Contents
1. [Project Overview Dashboard (Points 1-6)](#a-project-overview-dashboard-points-1-6)
2. [Site Reports UX (Points 7-14)](#b-site-reports-ux-points-7-14)
3. [Task Management (Points 15-19)](#c-task-management-points-15-19)
4. [Approvals Workflow (Points 20-23)](#d-approvals-workflow-points-20-23)
5. [Financial Integration (Points 24-26)](#e-financial-integration-points-24-26)
6. [Mobile & Field Experience (Points 27-29)](#f-mobile--field-experience-points-27-29)
7. [Reporting & Analytics (Point 30)](#g-reporting--analytics-point-30)
8. [Stakeholder Priority Matrix](#stakeholder-priority-matrix)

---

## A. Project Overview Dashboard (Points 1-6)

### 1. One-glance project health card
The overview needs a single status card — green/amber/red — combining budget burn, schedule adherence, and risk level. Right now the data exists across transactions, milestones, and tasks but isn't synthesized into one visual.

### 2. Gantt chart for milestones
The milestone tracking is date-based but there's no visual timeline. A lightweight Gantt (even a simple bar chart) showing planned vs actual dates per milestone would let the PM immediately see slippage.

### 3. Budget burn-down chart
Project transactions exist but the overview doesn't show a burn-down or burn-rate visualization. The PM needs to see "we've spent X of Y budget, and at current rate we'll run out by Z date."

### 4. Quick-action floating bar
When you're on a project overview on mobile, the key actions (log site report, add expense, view tasks) should be a floating bottom bar, not buried in navigation. The site engineer doesn't want to hunt for the "submit daily report" button.

### 5. Recent activity feed
A reverse-chronological feed of what happened on this project — who submitted a report, who approved what, what tasks moved — would give the PM and project engineer instant context without clicking into 5 different views.

### 6. Project comparison view
If you're managing 3-5 projects, you need a side-by-side comparison: which project is over budget, which is behind schedule, which has the most open issues. A portfolio-level dashboard is missing entirely.

---

## B. Site Reports UX (Points 7-14)

### 7. Draft auto-save with visual indicator
The site engineer is filling out a report on-site with poor connectivity. There's no visible "draft saved" indicator or auto-recovery. If the app crashes, they lose 20 minutes of work. This is a trust killer.

### 8. Photo capture improvements
The photo uploader exists but needs: camera roll integration for quick multi-select, before/after photo pairing (same location, different dates), and the ability to annotate photos with arrows/labels before attaching.

### 9. Weather auto-fill
Every site report asks for weather. It should auto-detect location and pull weather data automatically, with manual override. The site engineer shouldn't have to type "Partly cloudy, 34°C" every single day.

### 10. Stoppage timer widget
When a stoppage starts, there should be a running timer the engineer can start/stop — like a stopwatch — instead of manually entering start/end times. This is more accurate and less mental overhead.

### 11. Report template shortcuts
80% of daily reports are similar. Let the engineer "duplicate yesterday's report" and just modify what changed. The template system exists but there's no one-tap "copy previous" action.

### 12. Photo geotagging and map view
Photos should capture GPS coordinates, and there should be a map view showing where photos were taken across a project site. This helps the PM visualize site conditions without being there.

### 13. Report completion progress bar
While filling a site report, show a progress indicator: "60% complete — missing: weather, equipment list, photos." This prevents partial submissions and reduces back-and-forth during approval.

### 14. Voice-to-text for progress notes
The site engineer is walking around in a hard hat. Typing detailed progress notes on a phone is painful. A voice dictation option for the narrative field would be a massive quality-of-life win.

---

## C. Task Management (Points 15-19)

### 15. Drag-and-drop task reordering
The tasks page needs Kanban-style drag-and-drop: move tasks from "To Do" → "In Progress" → "Done." Right now it's a list with status dropdowns — too many taps.

### 16. Task dependencies visualizer
Dependencies exist in the schema but there's no visual representation of "Task B can't start until Task A is done." A simple dependency graph or blocked-by indicator prevents project engineers from planning work that can't actually begin.

### 17. Offline task status updates
The site engineer marks tasks done from the field. If there's no connectivity, those updates should queue and sync when back online — not fail silently.

### 18. Bulk task assignment
When setting up a project, assigning 50 tasks one-by-one is brutal. A bulk assignment mode where you select multiple tasks and assign them to a person or role would save hours.

### 19. Task time tracking
Let engineers log how long a task actually took vs estimated. This feeds the estimation module and helps the project engineer plan better next time.

---

## D. Approvals Workflow (Points 20-23)

### 20. Approval notification with context
When the PM gets an approval notification, it should show a preview of the report summary — not just "New site report pending review." Clicking through to see what you're approving should be one tap, not three.

### 21. Mobile approve/reject with swipe
On mobile, approving a report should be as easy as swiping right (approve) or left (reject) — like Tinder for approvals. The current flow requires opening, reading, scrolling, clicking approve, confirming. Too many steps for a busy PM.

### 22. Approval delegation
If the PM is on leave, approvals should be auto-delegated to the project engineer. The approval settings exist but delegation rules are missing.

### 23. Batch approval mode
The PM reviews 10-20 site reports daily. They need a "select all and approve" mode with a summary view, not one-by-one review.

---

## E. Financial Integration (Points 24-26)

### 24. Real-time budget alerts
When a project hits 70%, 85%, 90% of budget, auto-notify the PM and finance. Currently the data is there but there's no proactive alerting — you only find out when you check.

### 25. Invoice-to-project linking UX
Creating an invoice from a project currently requires navigating through a modal with multiple steps. The flow should be: "I did work → create invoice → link to project → done" in one streamlined path.

### 26. Expense receipt capture
When logging expenses, the engineer should snap a photo of the receipt and have it auto-attached to the expense entry. Currently it's manual upload after entering data — the data should flow from the receipt.

---

## F. Mobile & Field Experience (Points 27-29)

### 27. Bottom navigation redesign
The mobile nav should have 5 tabs: Dashboard | Projects | Reports | Tasks | More. Right now the navigation hierarchy is deep and the site engineer has to remember where things live.

### 28. Push notifications for assignments
When a task is assigned or a report is rejected, push to the engineer's phone. Email-only notifications get buried. This requires a notification service but the UX expectation is clear.

### 29. Offline-first architecture
The entire site report flow — forms, photos, task updates — should work offline with background sync. The docs mention "offline considerations" but the implementation is clearly online-first with graceful degradation rather than true offline-first.

---

## G. Reporting & Analytics (Point 30)

### 30. Custom report builder
The existing reports are fixed templates. The PM needs to build their own: "Show me all stoppages > 2 hours across all projects this month, grouped by cause." A filter-driven custom report builder with saved presets would be transformative.

---

## Stakeholder Priority Matrix

| Stakeholder | Top 5 Priorities |
|---|---|
| **MEP Manager** | #6 (portfolio view), #20 (approval context), #23 (batch approve), #24 (budget alerts), #30 (custom reports) |
| **Project Engineer** | #1 (health card), #2 (gantt), #3 (burn-down), #16 (dependencies), #19 (time tracking) |
| **Site Engineer** | #7 (auto-save), #8 (photos), #10 (stoppage timer), #14 (voice dictation), #29 (offline-first) |

---

## Proposed Phasing

### Phase 1 — Quick Wins (1-2 weeks)
- #7 Draft auto-save with visual indicator
- #4 Quick-action floating bar (mobile)
- #11 Report template shortcuts (copy previous)
- #13 Report completion progress bar
- #27 Bottom navigation redesign
- #20 Approval notification with context

### Phase 2 — Field Impact (3-4 weeks)
- #9 Weather auto-fill
- #10 Stoppage timer widget
- #14 Voice-to-text for progress notes
- #21 Mobile approve/reject with swipe
- #26 Expense receipt capture
- #28 Push notifications

### Phase 3 — PM Power Features (4-6 weeks)
- #1 One-glance project health card
- #3 Budget burn-down chart
- #5 Recent activity feed
- #23 Batch approval mode
- #24 Real-time budget alerts

### Phase 4 — Advanced (6-8 weeks)
- #2 Gantt chart for milestones
- #6 Project comparison / portfolio view
- #12 Photo geotagging and map view
- #15 Drag-and-drop Kanban tasks
- #16 Task dependencies visualizer
- #30 Custom report builder

### Phase 5 — Infrastructure (ongoing)
- #17 Offline task status updates
- #18 Bulk task assignment
- #19 Task time tracking
- #22 Approval delegation
- #25 Invoice-to-project linking UX
- #29 Offline-first architecture
