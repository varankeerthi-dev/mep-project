ERP Operations Dashboard UI Refactor (Enterprise SaaS)
Objective

Redesign the existing Operations Dashboard into a modern enterprise Operations Command Center.

This is NOT a KPI dashboard.

This is NOT a BI dashboard.

This is NOT PowerBI.

This is an ERP operational workspace where users should be able to understand today's business simply by looking at the dashboard.

The dashboard must prioritize real operational records, not summary numbers.

Every card should contain meaningful data that reduces clicks.

Think:

Linear
Notion databases
Stripe Dashboard
Vercel
Ramp
Modern ERP
Internal tools at large SaaS companies

Avoid anything resembling SAP GUI, Oracle Forms, or Excel.

Design Language

Minimal.

Professional.

Enterprise.

Airy.

High information density without feeling cluttered.

Soft shadows.

Almost invisible borders.

Rounded cards.

Large white space.

No gradients.

No glossy effects.

No neumorphism.

Overall Layout
Header
────────────────────────────────────

Needs Attention
(horizontal scrolling cards)

────────────────────────────────────

Live Operations
(3 columns)

────────────────────────────────────

Sales
Projects
Finance

────────────────────────────────────

Upcoming Visits

Maximum width

1600px

Horizontal padding

24px

Vertical padding

24px

Gap between sections

28px

Gap between cards

20px
Background
#F8FAFC

Cards

#FFFFFF

Never use pure gray cards.

Border

Instead of

1px solid #D9D9D9

use

1px solid #EEF2F6

Very subtle.

Border Radius

Large cards

16px

Small cards

12px

Badges

999px

Buttons

10px
Shadows

Cards

0 2px 6px rgba(15,23,42,.04),
0 8px 24px rgba(15,23,42,.05)

Hover

translateY(-2px)

shadow

0 12px 36px rgba(15,23,42,.08)

Transition

220ms ease
Typography

Font

Inter

or

Uncut Sans

Never use uppercase everywhere.

Font Scale

Page Title

34px

700

Subtitle

15px

500

#64748B

Section Heading

18px

650

Card Heading

15px

600

Primary Record

14px

600

Secondary

13px

500

Meta

12px

400

Badges

11px

600

Tiny labels

10px
Spacing System

Use only

4

8

12

16

20

24

32

40

Never random values.

Card Padding

Large Cards

20px

Small Cards

16px

Table rows

14px vertical

16px horizontal
Colors

Primary

#2563EB

Success

#22C55E

Warning

#F59E0B

Danger

#EF4444

Purple

#7C3AED

Text

#0F172A

Secondary

#64748B

Muted

#94A3B8

Divider

#EEF2F6
Cards

Every card should contain actual operational data.

Never display only

Manufacturing

5

Instead

Manufacturing WIP

Lot #A231

PN20 Green

420 / 600 pcs

████████░░

Shift B

ETA

3:20 PM

Supervisor

Ajay

Instead of

Dispatch

3

show

Dispatch

DC1421

RMG Polyvinyl

Truck

MH04AB1234

Driver

Ramesh

Started

09:35

ETA

03:20 PM

Status

En Route

Instead of

Projects

6

show

Ahmedabad Plant

68%

████████░░

Manager

Rahul

Next Milestone

Pressure Test

Tomorrow

Instead of

Finance

Pending

5

show

Advance Pending

RMG POLYVINYL

PO Value

₹14.2L

Advance

20%

██████░░░░

Pending

₹11.3L

65 Days
Needs Attention

This is the CEO feed.

Horizontal scrolling.

Each alert card

320px

height 180px

Contains

Alert Type

Company

Problem

Owner

Money

Age

CTA

Example

Advance Pending

RMG Polyvinyl

₹8.45L

Sales Owner

Rajesh

65 Days

Open →
Live Operations

Three equal-width columns.

Each column contains live records.

No empty KPI cards.

Columns

Site Check-ins

Manufacturing

Dispatch

Each row

Avatar

Title

Subtitle

Badge

Time
Tables

Avoid spreadsheet look.

Rows

56px

Hover

background

#F8FAFC

No vertical borders.

Only horizontal dividers.

Empty States

Never show

0

Instead

✓ Everything looks good

No manufacturing jobs running.

Use a small illustration or icon.

Badges

Height

22px

Padding

10px horizontal

Colors

Green

Blue

Orange

Red

Purple

Rounded

999px
Progress Bars

Height

6px

Radius

999px

Track

#E2E8F0

Fill

Blue

Orange

Green

Animate width

300ms ease
Icons

Lucide Icons only.

Size

18px

Icon container

34x34

Radius

10px

Background

Very light tint
Animation

Cards

Hover

translateY(-2px)

Shadow increase

Tables

Background fade

180ms

Accordion

200ms

Progress

300ms

Never use bouncing animations.

Responsiveness

Desktop

1600
1400
1200

Tablet

2 columns

Mobile

Single column
Critical Rule

Do not design this as a dashboard of numbers. Design it as an Operations Feed.

Every visible card must answer:

What happened?
Who is involved?
How much money?
What is the current status?
What action is needed?
When did it happen?

If a user can understand the day's business without opening another page, the design is successful.

Final Visual Goal

The finished UI should feel like Linear + Stripe Dashboard + Notion + Vercel, adapted for an ERP used by manufacturing, trading, and EPC companies. It should be clean, premium, modern, and information-rich without feeling crowded. It should look like software built in 2026, not a legacy ERP reskinned with rounded corners.