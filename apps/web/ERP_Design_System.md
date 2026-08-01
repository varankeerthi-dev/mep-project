SAKTHI ERP DESIGN SYSTEM v1.0
Philosophy
Design Keywords
Minimal
Premium
Professional
Industrial
Calm
Fast
Modern
Functional
Information Dense
Human Friendly

The ERP is not a marketing website.

It is a tool used for 8–10 hours daily by engineers, accountants, procurement teams, HR, and project managers.

Every design decision should reduce fatigue.

UX Principles
1. Speed over Decoration

Every interaction should reduce clicks.

Never add UI just because it looks pretty.

Everything must improve usability.

2. Information Density without Clutter

Show lots of information.

Never feel crowded.

Achieve this through

spacing
typography
grouping

Never through tiny fonts.

3. Progressive Complexity

Simple users should see simplicity.

Advanced users should never lose power.

Don't hide functionality.

Organize it.

4. Consistency over Creativity

Every page should feel like it belongs to the same application.

Buttons should never change style.

Tables should never change spacing.

Cards should never change padding.

Design Tokens
Background
App Background

#F8FAFC
Cards
White

#FFFFFF
Border
#E6EAF2
Primary
#6366F1

Hover

#4F46E5

Pressed

#4338CA
Success
#22C55E
Warning
#F59E0B
Danger
#EF4444
Typography

Primary

#111827

Secondary

#6B7280

Disabled

#9CA3AF
Spacing System

Never invent spacing.

Use only

4

8

12

16

20

24

32

40

48

64

Everything aligns to this scale.

Radius System
Input

10px

Button

10px

Card

16px

Modal

18px

Dialog

20px

Never use different values.

Shadow System

Small

0 2px 8px rgba(15,23,42,.04)

Medium

0 8px 24px rgba(15,23,42,.06)

Large

0 18px 48px rgba(15,23,42,.08)

Never use dark shadows.

Typography Scale

Page Title

30px

700

Section Title

18px

600

Card Title

16px

600

Field Label

13px

600

Input

14px

500

Helper

12px

400

Table

13px
Cards

Every module uses the same cards.

Padding

24px

Radius

16px

Border

1px

Shadow

Small

Cards never touch.

Gap

24px
Forms

Height

46px

Radius

10px

Padding

16px

Focus

Purple border

Soft ring

Labels

8px

above input
Buttons

Primary

44px

Purple

10px radius

Secondary

White

Border

Ghost

Transparent

Danger

Red
Tables

This is extremely important.

Your ERP has tables everywhere.

Every table should follow one design.

Header
44px

Uppercase removed

Weight 600

Muted background
Row
52px

Hover

Soft grey

Clickable
Borders

Only horizontal.

No vertical borders.

Pagination

Always

Bottom Right

Rows

Page

Previous

Next
Search Bars

Always

44px

Rounded

Search icon

Placeholder

Clear button
Filters

Appear as pills.

Not dropdown rows.

Example

All

Active

Closed

Draft

Approved
Badges

Small

Rounded

Never bright.

Draft

Grey

Approved

Green

Rejected

Red

Pending

Amber
Empty States

Every module gets an empty state.

Never

No data

Instead

Illustration

Heading

Description

Primary Action
Dialogs

Width

640px

Radius

18px

Padding

28px

Footer

Cancel

Primary
Side Panels

Slide from right.

Width

480px

Used for

Quick Edit

Preview

Comments

History

Navigation

Sidebar

72px collapsed

260px expanded

Icons

20px

Active

Purple background

Left indicator

Hover

Soft grey
Breadcrumb

Always

14px

Muted

Chevron separator
Dashboard Cards

One design only.

24px padding

Title

Metric

Trend

Mini chart
Charts

Minimal.

No bright colors.

No 3D.

Gridlines

Very light.

Mobile

Forms become

Single column.

Tables become

Cards.

Motion

Everything

180ms

Hover

translateY(-1px)

Dropdown

Fade

Scale

Dialog

Fade

Slide

Never bounce.

Accessibility

Always maintain

Keyboard navigation

Focus visibility

Contrast

ARIA

Code Rules

Every reusable component should exist only once.

Examples:

<AppCard>

<FormInput>

<FormSelect>

<FormSection>

<DataTable>

<PageHeader>

<EmptyState>

<StatusBadge>

<ActionButton>

<StickyFooter>

Never duplicate styles.

Everything should come from reusable design tokens.

The "Sakthi Feeling"

Every screen should satisfy these questions before it is accepted:

Can a new employee understand this screen within 30 seconds?
Can an experienced employee finish work without unnecessary clicks?
Does the screen feel calm rather than overwhelming?
Is the visual hierarchy obvious without relying on color?
Does every spacing value align to the design system?
Would this page still look consistent if viewed next to the Dashboard, HR, CRM, Inventory, and Projects modules?
If I removed all colors, would typography and spacing alone still communicate hierarchy?