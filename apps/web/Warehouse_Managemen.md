# Warehouse Management System (WMS) PRD
## ORGIN ERP

Version: 1.0
Status: Frozen
Author: Product Team
Last Updated: August 2026

---

# 1. Executive Summary

## 1.1 Overview

The Warehouse Management System (WMS) for ORGIN ERP is designed as a modern, visual-first warehouse execution platform for manufacturing, trading, EPC, distribution and inventory-driven organizations.

Unlike traditional ERP warehouse modules that focus only on inventory transactions, this module combines warehouse design, inventory location management, replenishment, warehouse visualization, and operational workflows into a single unified experience.

The primary objective is to allow warehouse operators and administrators to configure, visualize, manage and search warehouse inventory with minimal effort while maintaining enterprise-grade scalability.

The system is designed around the philosophy that warehouse users should work visually instead of memorizing rack numbers or navigating multiple data-entry screens.

---

# 1.2 Vision Statement

Create a warehouse management experience that is:

• Visual rather than text-heavy

• Configuration-driven rather than hardcoded

• Spreadsheet-friendly rather than form-heavy

• Operational rather than administrative

• Fast enough for warehouse operators

• Flexible enough for any manufacturing layout

• Scalable enough for enterprise customers

---

# 1.3 Product Philosophy

The warehouse should behave like a digital representation of the physical warehouse.

Users should be able to:

• Design their warehouse visually

• Automatically generate racks and bins

• Configure naming conventions

• Locate inventory instantly

• Search visually

• Drag and reorganize layouts

• Perform replenishment with minimal clicks

• View warehouse utilization in real time

Every screen should reduce manual work.

Every workflow should minimize repetitive operations.

---

# 1.4 Primary Goals

The module shall:

• Eliminate manual bin creation.

• Support unlimited warehouse layouts.

• Support multiple floors.

• Support multiple zones.

• Support different rack configurations inside the same warehouse.

• Support different naming conventions.

• Support visual warehouse navigation.

• Support multiple storage roles.

• Support QR-based warehouse operations.

• Support future AI-assisted warehouse optimization.

---

# 1.5 What This Module Is

This module is a complete Warehouse Management System consisting of:

• Warehouse Designer

• Warehouse Viewer

• Item Location Manager

• Replenishment Manager

• Internal Transfer Manager

• Warehouse Dashboard

• Warehouse Search Engine

• Warehouse Analytics

---

# 1.6 What This Module Is NOT

This module is NOT:

• A simple warehouse master

• A list of storage locations

• A collection of inventory tables

• A fixed warehouse template

• A barcode-only solution

Instead, it is a configurable warehouse platform.

---

# 1.7 UX Principles

The following UX principles are mandatory throughout the module.

## Visual First

Whenever possible, represent the warehouse visually instead of using tables.

---

## Configure Once

Users should configure layouts once.

The ERP should generate everything else automatically.

---

## Never Ask Users To Repeat Work

If the system can generate names, create bins or recommend locations automatically, it must do so.

---

## Bulk Operations First

Warehouse staff work with hundreds or thousands of locations.

Every repetitive operation must support:

• Bulk Edit

• Multi Select

• Excel Import

• Excel Export

• Copy/Paste

• Fill Down

---

## Search Everywhere

Every important object must be searchable.

Examples:

Warehouse

Floor

Zone

Layout

Rack

Bin

QR Code

Barcode

Item

Transaction

---

## Mobile Friendly

Every warehouse operation should eventually be executable from a mobile device.

QR workflows must be considered from the beginning.

---

## Future Ready

The architecture shall support future features including:

• AI Recommendations

• Warehouse Heat Maps

• Smart Put-away

• Picking Optimization

• Digital Twin

• RFID

• IoT Integration

without redesigning the database.

---

# 1.8 Success Criteria

The Warehouse Management module will be considered successful when:

• A new warehouse can be configured without developer assistance.

• A warehouse with thousands of bins can be generated within minutes.

• Users can locate any item in seconds.

• Warehouse operators can complete replenishment without navigating multiple screens.

• Warehouse layouts can be modified visually.

• Inventory locations remain synchronized after layout changes.

• The system scales from a small warehouse to large multi-floor manufacturing plants.

---

# 1.9 Product Status

This Product Requirement Document (PRD) represents the frozen functional specification for the Warehouse Management System.

The architecture, workflows and UX decisions described in this document have been reviewed and finalized.

Future enhancements may extend the module but should not violate the core architectural principles defined in this specification.

---
# 2. Information Architecture & Module Navigation

---

# 2.1 Design Philosophy

The Warehouse Management module shall be designed around **daily warehouse operations**, not around master data maintenance.

Traditional ERP systems place configuration pages before operational workflows. This results in warehouse operators navigating through multiple menus to complete simple tasks.

ORGIN ERP shall reverse this approach.

The default landing page shall always focus on:

- What requires attention today
- What actions need to be completed
- What inventory requires movement
- What replenishment is pending
- What warehouse activities are currently happening

Configuration pages shall remain accessible but shall never become the primary working screen.

---

# 2.2 Module Navigation

Warehouse Management

│

├── Dashboard (Default)

├── Table View

├── Warehouse Viewer (2D / Future 3D)

├── Warehouse Designer

├── Internal Transfers

├── Reports

└── Settings

---

# 2.3 Navigation Responsibilities

Each page shall have one clear responsibility.

---

## Dashboard

Purpose

Daily warehouse execution.

Primary Users

Warehouse Supervisor

Warehouse Operator

Store In-charge

Production Planner

Responsibilities

• Today's warehouse status

• Pending replenishments

• Pending transfers

• Low stock alerts

• Warehouse activity

• Warehouse utilization

• Search

• Quick actions

The dashboard shall never become a configuration page.

---

## Table View

Purpose

Administration and bulk editing.

Primary Users

Warehouse Administrator

Inventory Controller

Master Data Team

Responsibilities

Warehouse Master

Floor Master

Zone Master

Rack Master

Bin Master

Item ↔ Bin Mapping

Transfer Rules

Replenishment Rules

Import

Export

Bulk Edit

The Table View shall behave like an enterprise spreadsheet.

---

## Warehouse Viewer

Purpose

Visual warehouse navigation.

Primary Users

Warehouse Staff

Picking Team

Production Team

Responsibilities

Visual warehouse

Search

Highlight bins

Rack inspection

Occupancy

Navigation

Future

Three.js visualization

Warehouse Viewer shall never become a configuration screen.

---

## Warehouse Designer

Purpose

Design physical warehouse layouts.

Primary Users

Administrator

Implementation Team

Responsibilities

Warehouse creation

Floors

Zones

Layouts

Rack generation

Naming

Bin generation

Drag & Drop

Configuration

This screen is expected to be used infrequently after implementation.

---

## Internal Transfers

Purpose

Movement of inventory between warehouse locations.

Examples

Bulk Storage

↓

Picking

Picking

↓

Dispatch

Receiving

↓

Bulk Storage

Quality Hold

↓

Approved Storage

Responsibilities

Transfer Requests

Transfer Approval

Transfer Execution

Transfer History

---

## Reports

Purpose

Warehouse analytics.

Examples

Storage utilization

Inventory location report

Rack occupancy

Bin occupancy

Warehouse efficiency

Movement analysis

Dead stock

Fast moving items

Slow moving items

Transfer analysis

Cycle count reports

Reports are analytical only.

No configuration.

---

## Settings

Purpose

Global warehouse configuration.

Responsibilities

Naming templates

Default dimensions

QR configuration

Barcode settings

Warehouse preferences

Future integrations

Settings should rarely change.

---

# 2.4 Dashboard Structure

Dashboard is the default landing page.

It shall consist of two sub-tabs.

Warehouse Management

│

├── Dashboard

└── Table View

Users performing daily operations should rarely leave these two tabs.

---

# 2.5 Dashboard Sections

The dashboard shall be divided into logical operational cards.

Top Section

Warehouse Summary

Quick Search

Today's Tasks

Quick Actions

AI Recommendations

---

Operations Section

Pending Replenishment

Pending Transfers

Receiving Queue

Dispatch Queue

Cycle Count Queue

Quality Hold Queue

---

Warehouse Section

Warehouse Heat Map

Storage Utilization

Zone Utilization

Most Congested Zones

Warehouse Activity

---

Insights Section

Fast Moving Items

Slow Moving Items

Frequently Picked Items

Unused Storage

Warehouse Efficiency

---

# 2.6 Table View Structure

Table View shall support multiple datasets.

Warehouse

Floors

Zones

Layouts

Racks

Bins

Items

Location Mapping

Transfer History

Replenishment Rules

QR Labels

Every table shall support:

Inline Editing

Filtering

Sorting

Grouping

Saved Views

Excel Import

Excel Export

Copy

Paste

Fill Down

Undo

Redo

Keyboard Navigation

Column Personalization

Pagination

Advanced Search

---

# 2.7 Navigation Rules

Dashboard

↓

Open Item

↓

Warehouse Viewer

↓

Highlight Bin

↓

Open Bin Details

↓

Perform Transfer

↓

Return to Dashboard

Navigation should always preserve context.

Users should never lose their current search.

---

# 2.8 Quick Search

Quick Search shall always be visible from the Dashboard.

Supported searches:

Item Name

Item Code

Barcode

QR Code

Rack

Bin

Warehouse

Zone

Results shall immediately open the Warehouse Viewer with the selected location highlighted.

No intermediate pages.

---

# 2.9 Quick Actions

Dashboard shall provide one-click operational shortcuts.

Examples

Receive Material

Internal Transfer

Search Warehouse

Print QR Labels

Cycle Count

Locate Item

Generate Warehouse Report

Create Warehouse

Create Zone

Create Layout

Quick Actions should launch workflows directly.

---

# 2.10 Today's Tasks

The dashboard shall automatically generate operational tasks.

Examples

Refill 12 Picking Bins

Approve 4 Internal Transfers

Receive Purchase Order #458

Dispatch Sales Order #1032

Complete Cycle Count

Review Quality Hold Items

Tasks shall disappear automatically upon completion.

No manual task management.

---

# 2.11 Notification Center

The dashboard shall include operational notifications.

Examples

Picking Bin Below Minimum

Bulk Storage Full

Transfer Delayed

Cycle Count Due

Warehouse Capacity Above 90%

Bin Blocked

Quality Inspection Pending

Notifications shall always provide direct navigation to the related record.

---

# 2.12 UX Rules

Dashboard

Operational

Action-oriented

Minimal data entry

Real-time updates

Fast navigation

---

Table View

Administrative

Spreadsheet experience

Bulk editing

Mass configuration

---

Warehouse Viewer

Visual

Interactive

Search-oriented

Location-based

---

Warehouse Designer

Configuration only

Visual generation

Drag & Drop

Layout management

---

# 2.13 Things To Avoid

Do NOT create multiple disconnected warehouse pages.

Do NOT duplicate functionality between Dashboard and Table View.

Do NOT mix configuration screens with operational screens.

Do NOT require users to navigate multiple pages for simple warehouse tasks.

Do NOT overload the dashboard with decorative charts.

Every dashboard component must either:

• Display actionable information

or

• Allow immediate user action.

This principle shall be followed throughout the Warehouse Management module.

---
# 3. Warehouse Hierarchy & Data Model

---

# 3.1 Overview

The Warehouse Management System shall be built using a hierarchical architecture that mirrors the physical warehouse.

This hierarchy is the foundation for every module including:

- Warehouse Designer
- Warehouse Viewer
- Item Location Manager
- Replenishment
- Internal Transfers
- Search
- QR Navigation
- Warehouse Analytics

This hierarchy shall never be violated.

---

# 3.2 Standard Hierarchy

Warehouse

↓

Floor

↓

Zone

↓

Layout

↓

Rack

↓

Bin

↓

Inventory

Every inventory transaction ultimately belongs to a Bin.

---

# 3.3 Why This Hierarchy?

Traditional ERP systems store inventory directly against warehouses.

Example

Warehouse A

↓

Inventory

This approach fails because it cannot answer questions like:

• Which floor?

• Which rack?

• Which bin?

• Which picking location?

• Which reserve location?

ORGIN ERP solves this by storing inventory at the smallest physical location.

That location is always the Bin.

---

# 3.4 Warehouse

A Warehouse represents an independent physical storage facility.

Examples

Main Factory Warehouse

Secondary Warehouse

North Warehouse

Outdoor Warehouse

Rental Warehouse

Every warehouse may contain:

Multiple Floors

Multiple Zones

Multiple Layouts

Thousands of Racks

Unlimited Bins

---

Warehouse Properties

Warehouse Name

Warehouse Code

Address

Description

Status

Default Working Hours

Manager

GPS (Future)

Drawing (Future)

Warehouse Image (Future)

---

Rules

Warehouse contains one or more Floors.

Warehouse itself does NOT define layouts.

Warehouse itself does NOT define rack styles.

Warehouse itself does NOT define storage roles.

Those belong to Zones.

---

# 3.5 Floor

A Floor represents a physical level inside a warehouse.

Examples

Ground Floor

Mezzanine

First Floor

Second Floor

Basement

Outdoor Yard

Every warehouse supports unlimited floors.

Companies with only one floor simply use Ground Floor.

---

Floor Properties

Name

Display Order

Description

Height

Status

Floor Plan Image (Future)

---

Rules

Each Floor contains multiple Zones.

Floor switching should be instant inside the Warehouse Viewer.

---

# 3.6 Zone

Zone is one of the most important concepts in the entire system.

A Zone represents a logical storage area.

Examples

Raw Material Bulk Zone

Raw Material Picking Zone

Finished Goods Bulk Zone

Finished Goods Picking Zone

Finished Goods Dispatch Zone

Finished Goods Returns Zone

Quality Hold Zone

Packaging Zone

Maintenance Zone

Outdoor Storage Zone

Users may create unlimited custom Zones.

---

Zone Properties

Zone Name

Zone Code

Storage Role

Description

Color

Status

Default Layout

---

Why Zones?

Instead of creating separate warehouses for every purpose, users divide a warehouse into meaningful operational areas.

Example

Main Warehouse

Ground Floor

├── RM Bulk Zone

├── RM Picking Zone

├── FG Bulk Zone

├── FG Dispatch Zone

└── Returns Zone

This mirrors how real manufacturing plants operate.

---

# 3.7 Storage Roles

Every Zone shall have a Storage Role.

Storage Roles define WHY inventory exists in that Zone.

Supported Roles

Bulk Storage

Picking

Receiving

Dispatch

Returns

Quality Hold

Overflow

Maintenance

Custom

Business logic shall always use Storage Roles instead of warehouse names.

Example

DO NOT

"If warehouse = Bulk Warehouse"

DO

"If Storage Role = Bulk Storage"

This makes the system configurable.

---

# 3.8 Layout

Every Zone may contain one or more Layouts.

This is a mandatory design principle.

A warehouse is never assumed to have a single layout.

Example

Raw Material Bulk Zone

Layout 1

Grid

Layout 2

Parallel Rows

Layout 3

U Shape

Each layout behaves independently.

---

Supported Layout Types

Grid

Parallel Rows

Double Aisle

Single Aisle

U Shape

L Shape

Open Yard

Custom

Future

ASRS

Cold Storage

Robotic Storage

---

Rules

Layouts belong to Zones.

Layouts never belong directly to Warehouses.

Multiple layouts may exist inside one Zone.

---

# 3.9 Rack

A Rack represents the physical storage structure.

Each Layout contains one or more Racks.

Example

Grid Layout

Rack A

Rack B

Rack C

Rack D

Each Rack may have different dimensions.

Each Rack may have different level counts.

Never assume all racks are identical.

---

Rack Properties

Rack Name

Rack Code

Width

Depth

Height

Columns

Levels

Rotation

Spacing

Maximum Weight

Status

QR Code

Barcode

---

Rules

Rack dimensions are independent.

Rack naming is configurable.

Rack level count is configurable.

---

# 3.10 Bin

A Bin is the smallest physical storage location.

Every inventory quantity belongs to a Bin.

Examples

A-01-L1

A-02-L2

RM-A-12

FG-D-04

---

Bin Properties

Bin Name

QR Code

Barcode

Width

Depth

Height

Maximum Quantity

Maximum Weight

Maximum Volume

Current Quantity

Occupancy %

Status

Notes

---

Supported Status

Available

Occupied

Reserved

Blocked

Maintenance

Quality Hold

Cycle Count

Returns

---

Rules

Multiple inventory items may exist inside one Bin.

Occupancy shall always be displayed.

Users shall never manually create bins one byone.

Bins are automatically generated.

---

# 3.11 Inventory

Inventory is always stored against Bins.

Never directly against Warehouses.

Never directly against Zones.

Never directly against Racks.

Inventory Location Example

Warehouse

↓

Ground Floor

↓

RM Picking Zone

↓

Grid Layout

↓

Rack A

↓

Bin A-03-L2

↓

PVC Pipe

320 Pieces

This allows precise inventory tracking.

---

# 3.12 Multiple Item Locations

The same item may exist in multiple Bins simultaneously.

Example

PVC Pipe

RM Bulk Zone

4,800 pcs

RM Picking Zone

320 pcs

Receiving Zone

1,200 pcs

Quality Hold Zone

80 pcs

Search shall display every location.

Never hide secondary locations.

---

# 3.13 Internal Movement

Inventory moves between Bins.

Examples

Bulk Storage

↓

Picking

Receiving

↓

Bulk Storage

Picking

↓

Dispatch

Quality Hold

↓

Approved Storage

Warehouse totals remain unchanged.

Only locations change.

---

# 3.14 Future Scalability

This hierarchy shall support future features without redesign.

Examples

QR Navigation

Barcode Scanning

RFID

IoT Sensors

Weight Sensors

Digital Twin

AI Put-away

Picking Optimization

Drone Inventory

Augmented Reality Navigation

Warehouse Robotics

---

# 3.15 Things To Avoid

DO NOT store inventory directly under Warehouses.

DO NOT hardcode storage roles.

DO NOT assume all racks have equal dimensions.

DO NOT assume all layouts are Grid layouts.

DO NOT assume every warehouse has one floor.

DO NOT assume one item belongs to one Bin.

DO NOT force users to create multiple warehouses when Zones solve the problem.

DO NOT couple business logic with warehouse names.

Everything must remain configuration-driven.

---

# 3.16 Design Principles

The hierarchy defined above is the permanent architectural foundation of the Warehouse Management System.

All future modules, workflows, reports, dashboards, AI recommendations and mobile applications shall use this hierarchy.

Changing this hierarchy in future versions should be considered a breaking architectural change and must be avoided.

---
# 4. Warehouse Dashboard & Operational Workspace

---

# 4.1 Overview

The Dashboard shall be the **default landing page** of the Warehouse Management module.

This is not a reporting dashboard.

This is an **Operations Dashboard**.

The purpose is to tell warehouse users:

- What requires attention
- What needs action
- What inventory requires movement
- What inventory requires replenishment
- What work is pending today

Users should be able to complete the majority of daily warehouse operations directly from the Dashboard without navigating multiple pages.

---

# 4.2 Dashboard Philosophy

The Dashboard shall always answer the following questions.

• What needs my attention?

• Which bins require replenishment?

• Which transfers are pending?

• Which warehouse areas are full?

• Which warehouse activities are currently happening?

• What should I do next?

The dashboard shall never become a configuration screen.

---

# 4.3 Dashboard Structure

Warehouse Management

│

├── Dashboard (Default)

└── Table View

Dashboard = Daily Operations

Table View = Administration & Bulk Editing

---

# 4.4 Dashboard Design Guidelines

The dashboard UI shall follow a modern card-based design.

Reference Style

Modern

Minimal

Professional

Action-oriented

Not chart-heavy

Use

✓ White background

✓ Soft shadows

✓ Equal card spacing

✓ Rounded cards

✓ Responsive layout

✓ Status colors

Avoid

✗ Decorative charts

✗ Unnecessary animations

✗ Large KPI walls

Every card should either

Display important information

OR

Allow immediate action.

---

# 4.5 Dashboard Layout

--------------------------------------------------

Warehouse Summary

Quick Search

Today's Tasks

Quick Actions

--------------------------------------------------

Replenishment Queue

Internal Transfers

Receiving Queue

Dispatch Queue

--------------------------------------------------

Warehouse Heat Map

Warehouse Activity

Stock Alerts

AI Suggestions

--------------------------------------------------

Storage Utilization

Fast Moving Items

Slow Moving Items

Cycle Count Queue

--------------------------------------------------

The layout shall automatically adapt for tablets and mobile devices.

---

# 4.6 Warehouse Summary

Purpose

Provide an instant overview of warehouse health.

Display

Total Warehouses

Total Floors

Total Zones

Total Layouts

Total Racks

Total Bins

Occupied Bins

Available Bins

Overall Capacity

Warehouse Efficiency

Every KPI card should support click-through navigation.

Example

Occupied Bins

↓

Open Bin Utilization Report

---

# 4.7 Quick Search

Quick Search shall always remain visible.

Search by

Item Name

Item Code

Barcode

QR Code

Warehouse

Floor

Zone

Rack

Bin

Transaction Number

Search Results

Immediately open Warehouse Viewer

Automatically highlight searched location

Display stock summary

Display all available locations

No intermediate pages.

---

# 4.8 Today's Tasks

The system automatically generates today's work.

Example

□ Refill 12 Picking Bins

□ Complete 5 Internal Transfers

□ Receive Purchase Order #1024

□ Dispatch Sales Order #568

□ Complete Cycle Count

□ Review Quality Hold Items

Tasks disappear automatically after completion.

Users should never maintain task lists manually.

---

# 4.9 Quick Actions

Provide one-click shortcuts.

Receive Material

Internal Transfer

Search Item

Locate Bin

Print QR Labels

Generate Warehouse

Create Zone

Cycle Count

Warehouse Viewer

Every Quick Action opens the workflow immediately.

---

# 4.10 Replenishment Queue

One of the most important dashboard widgets.

Purpose

Display Picking bins below their minimum quantity.

Example

PVC Resin

Current

120 kg

Minimum

200 kg

Target

500 kg

Suggested Source

RM Bulk Zone

Available

2,800 kg

Action

Transfer

One click should initiate replenishment.

---

# 4.11 Internal Transfer Queue

Display warehouse transfers.

Statuses

Requested

Approved

Picking

In Progress

Completed

Cancelled

Example

RM Bulk

↓

RM Picking

300 kg

Status

Waiting

Approve

Reject

Execute

---

# 4.12 Receiving Queue

Displays incoming inventory.

Examples

Pending Purchase Orders

Pending Production Output

Pending Vendor Deliveries

Pending Returns

Actions

Receive

Inspect

Allocate Bin

Print Labels

---

# 4.13 Dispatch Queue

Displays outgoing inventory.

Pending Sales Orders

Reserved Inventory

Picking Pending

Packing Pending

Ready To Dispatch

Dispatch Completed

Warehouse staff should manage dispatch from here.

---

# 4.14 Warehouse Heat Map

A miniature warehouse overview.

Purpose

Instantly identify congestion.

Bin Colors

Green

Available

Yellow

Medium Occupancy

Orange

Nearly Full

Red

Full

Blue

Reserved

Purple

Quality Hold

Clicking the heat map opens Warehouse Viewer.

---

# 4.15 Warehouse Activity

Real-time warehouse timeline.

Examples

09:10

Received Material

PO-1024

-------------------

09:22

Internal Transfer

RM Bulk

↓

RM Picking

-------------------

09:31

Cycle Count Completed

-------------------

09:45

Dispatch Completed

-------------------

Newest activity always appears first.

---

# 4.16 Stock Alerts

Critical warehouse alerts.

Low Picking Quantity

Bin Full

Bin Blocked

Expired Material

No Movement

Quality Hold

Damaged Stock

Cycle Count Due

Alerts must support one-click navigation.

---

# 4.17 AI Recommendations

Future-ready section.

Examples

Recommended Replenishment

Suggested Put-away Location

Unused Storage

Merge Similar Inventory

Rearrange Picking Locations

Frequently Picked Together

Initially this section may contain rule-based recommendations.

AI models can replace rules in future.

---

# 4.18 Storage Utilization

Display

Warehouse Occupancy

Zone Occupancy

Rack Occupancy

Bin Occupancy

Display

Current

Maximum

Available

Occupancy %

Support drill-down.

Warehouse

↓

Zone

↓

Rack

↓

Bin

---

# 4.19 Fast Moving Items

Display

Top picked items

Top transferred items

Highest consumption

Top replenished items

Purpose

Warehouse optimization.

---

# 4.20 Slow Moving Items

Display

Dead Stock

No Movement

Overstock

Aging Inventory

Purpose

Storage optimization.

---

# 4.21 Cycle Count Queue

Display

Pending Counts

In Progress

Completed Today

Overdue Counts

Warehouse supervisors should manage counting activities from this card.

---

# 4.22 Dashboard Refresh

Dashboard data shall update automatically.

Real-time where possible.

Otherwise

30-second refresh

Manual refresh button

Background refresh shall never interrupt user workflows.

---

# 4.23 Personalization

Users may customize.

Card Position

Card Size

Hidden Cards

Favorite Widgets

Saved Dashboard Layouts

Reset Dashboard

Customization shall be user-specific.

---

# 4.24 Responsive Behaviour

Desktop

Four-column layout.

Tablet

Two-column layout.

Mobile

Single-column scrolling layout.

Quick Search and Today's Tasks should always remain near the top.

---

# 4.25 Things To Avoid

DO NOT fill the dashboard with charts.

DO NOT show unnecessary KPIs.

DO NOT duplicate information already visible elsewhere.

DO NOT force users into reports for daily operations.

DO NOT make the dashboard a configuration page.

The Dashboard is an execution workspace, not a reporting portal.

---

# 4.26 Dashboard Success Criteria

A warehouse supervisor should be able to open the Dashboard and within **30 seconds** know:

• What requires replenishment.

• What transfers are pending.

• Which inventory requires attention.

• Which warehouse areas are congested.

• Which work is pending today.

• What actions can be completed immediately.

If the Dashboard enables this without requiring users to navigate multiple screens, then the UX objective has been achieved.

---
# 5. Warehouse Designer (Visual Layout Builder)

---

# 5.1 Overview

The Warehouse Designer is the heart of the Warehouse Management System.

Its purpose is to allow users to visually build a digital representation of their physical warehouse without requiring technical knowledge.

Unlike traditional ERP systems that require users to manually create warehouses, racks and bins one by one, ORGIN ERP shall provide an intelligent visual designer that generates the warehouse automatically based on user configuration.

The Warehouse Designer is primarily used during implementation and whenever the warehouse undergoes physical changes.

It is **not** intended for daily warehouse operations.

---

# 5.2 Design Philosophy

The Warehouse Designer shall follow four core principles.

### Visual Before Data Entry

Users should build warehouses visually instead of completing long forms.

---

### Configure Once

Users configure the warehouse once.

The system generates everything else automatically.

---

### Live Preview

Every change made by the user shall immediately update the warehouse preview.

Users should never wonder how the final warehouse will look.

---

### Never Start With A Blank Screen

A blank canvas is intimidating.

The system shall always guide the user using templates, presets and visual examples.

---

# 5.3 Screen Layout

The Warehouse Designer shall use a split-screen layout.

------------------------------------------------------------

Left Panel

Configuration Wizard

↓

Warehouse Preview (Right)

------------------------------------------------------------

Left Panel

Properties

Configuration

Templates

Actions

Right Panel

Interactive Warehouse Preview

2D

Future

3D (Three.js)

---

# 5.4 Designer Workflow

The recommended workflow is

Step 1

Create Warehouse

↓

Step 2

Add Floor

↓

Step 3

Create Zone

↓

Step 4

Choose Layout

↓

Step 5

Configure Racks

↓

Step 6

Configure Naming

↓

Step 7

Generate Bins

↓

Step 8

Review Preview

↓

Step 9

Save

The system should guide users through these steps using a wizard.

---

# 5.5 Warehouse Creation

Users begin by creating a warehouse.

Required Fields

Warehouse Name

Warehouse Code

Description

Status

Default Floor

Optional

Address

Warehouse Image

Manager

GPS Coordinates

Working Hours

---

# 5.6 Floor Management

Users may create unlimited floors.

Examples

Ground Floor

Mezzanine

First Floor

Second Floor

Basement

Outdoor Yard

Floor ordering shall support drag & drop.

Users can rearrange floors anytime.

---

# 5.7 Zone Creation

Every Floor contains one or more Zones.

Examples

Raw Material Bulk Zone

Raw Material Picking Zone

Finished Goods Bulk Zone

Finished Goods Picking Zone

Finished Goods Dispatch Zone

Quality Hold Zone

Returns Zone

Users may create unlimited custom zones.

Each Zone shall support:

Name

Description

Storage Role

Color

Status

---

# 5.8 Layout Templates

Every Zone may contain multiple layouts.

Supported templates

Grid

Parallel Rows

U Shape

L Shape

Double Aisle

Single Aisle

Open Yard

Custom Layout

Future

ASRS

Cold Storage

Automated Warehouse

Every layout card shall display a visual preview.

Users select visually rather than from a dropdown.

---

# 5.9 Multiple Layout Support

A Zone may contain multiple layouts simultaneously.

Example

RM Bulk Zone

Grid Layout

Parallel Layout

U Layout

Users may add, remove or duplicate layouts.

Layouts shall be completely independent.

---

# 5.10 Layout Configuration

Each Layout shall support

Name

Description

Orientation

Scale

Spacing

Rotation

Aisle Width

Walkway Width

Default Rack Direction

Every configuration change updates the preview immediately.

---

# 5.11 Rack Generator

Users never create racks individually.

Instead they configure generation rules.

Examples

Rows

5

Columns

10

Default Levels

3

Rack Prefix

A

System generates

A1

A2

A3

...

Users may override individual racks later.

---

# 5.12 Individual Rack Configuration

Every Rack may have different properties.

Example

Rack A

Columns

10

Levels

3

Rack B

Columns

8

Levels

2

Rack C

Columns

12

Levels

5

Never assume identical racks.

---

# 5.13 Rack Dimensions

Each Rack stores

Width

Depth

Height

Maximum Weight

Maximum Volume

Walkway Clearance

Rack Rotation

Future

Load Rating

Manufacturer

Installation Date

---

# 5.14 Naming Engine

Naming shall be configurable.

Supported examples

A

B

C

or

RM

FG

PK

or

North

South

East

Users choose

Prefix

Separator

Numbering

Padding

Level Format

Preview updates live.

---

# 5.15 Bin Generator

The ERP automatically generates bins.

Example

Rack

A

Columns

10

Levels

3

Generated

A-01-L1

A-01-L2

A-01-L3

A-02-L1

...

Users should never manually create hundreds of bins.

---

# 5.16 Bin Naming Preview

Before generation, display

Example Output

A-01-L1

A-01-L2

A-01-L3

...

Users may modify naming before generation.

---

# 5.17 Live Warehouse Preview

The preview shall update continuously.

Supported interactions

Zoom

Pan

Fit to Screen

Reset View

Select Rack

Select Bin

Hover Information

Grid Toggle

Future

3D Camera

---

# 5.18 Drag & Drop

Users may drag

Layouts

Racks

Zones

Future

Entire Floor Sections

Dragging updates the preview instantly.

No manual coordinate editing.

---

# 5.19 Duplicate Layout

Users may duplicate

Entire Layout

Entire Zone

Selected Rack

Selected Rack Group

Purpose

Reduce repetitive configuration.

---

# 5.20 Undo / Redo

Designer shall support

Undo

Redo

History Stack

Restore Previous Version

Users should never fear experimentation.

---

# 5.21 Validation

Before saving

Validate

Duplicate Rack Names

Duplicate Bin Names

Missing Zones

Missing Layouts

Invalid Dimensions

Naming Conflicts

Generation Errors

Prevent invalid warehouse configurations.

---

# 5.22 Save Behaviour

Users explicitly save the design.

Saving performs

Validation

Generation

Database Synchronization

Preview Refresh

After save

Warehouse Viewer immediately reflects the latest layout.

---

# 5.23 Future Three.js Support

The designer shall initially use a high-performance 2D engine.

The architecture must allow replacing or augmenting the preview with a Three.js renderer without redesigning the configuration model.

The data model shall remain renderer-independent.

---

# 5.24 Things To Avoid

DO NOT start with an empty canvas.

DO NOT ask users to manually create hundreds of racks.

DO NOT ask users to manually create bins.

DO NOT hardcode naming formats.

DO NOT assume one layout per warehouse.

DO NOT assume one rack design.

DO NOT require page reloads after every change.

DO NOT separate configuration from preview.

The user should always see the effect of their actions immediately.

---

# 5.25 Success Criteria

The Warehouse Designer is successful when:

• A non-technical warehouse administrator can create an entire warehouse without developer assistance.

• A warehouse containing thousands of bins can be generated in minutes.

• Every configuration change is immediately visible.

• The generated warehouse accurately represents the physical warehouse.

• Future modifications require only configuration changes rather than rebuilding the warehouse.

The Warehouse Designer shall be treated as a visual design tool rather than a traditional ERP master screen.

---
# 6. Rack, Bin & Smart Capacity Management

---

# 6.1 Overview

Racks and Bins are the core physical storage units of the Warehouse Management System.

Unlike traditional ERP systems where a Bin is merely a location code, ORGIN ERP shall treat every Bin as an intelligent storage unit capable of understanding:

• Capacity

• Occupancy

• Dimensions

• Weight

• Volume

• Multiple Inventory

• Replenishment

• QR Identification

• Operational Status

This enables warehouse users to understand warehouse health at a glance.

---

# 6.2 Design Philosophy

Every Bin should answer these questions immediately.

• What is stored here?

• How much is stored here?

• How much free space remains?

• Is replenishment required?

• Is the bin available?

• Can this item physically fit?

Warehouse staff should never need multiple screens to answer these questions.

---

# 6.3 Rack

A Rack is a physical storage structure.

Every Rack belongs to

Warehouse

↓

Floor

↓

Zone

↓

Layout

Each Rack contains one or more Bins.

---

# 6.4 Rack Properties

General

Rack Name

Rack Code

Description

QR Code

Barcode

Status

Physical

Width

Depth

Height

Number of Columns

Number of Levels

Maximum Weight

Maximum Volume

Orientation

Rotation

Operational

Storage Role

Preferred Item Type

Default Bin Capacity

Notes

Future

Manufacturer

Installation Date

Inspection Date

Maintenance Schedule

---

# 6.5 Rack Status

Available

Partially Occupied

Full

Blocked

Maintenance

Reserved

Inactive

Status shall be visible directly in the Warehouse Viewer.

---

# 6.6 Bin

A Bin is the smallest inventory location.

Inventory always belongs to a Bin.

Never to a Rack.

Never to a Zone.

Never directly to a Warehouse.

---

# 6.7 Bin Properties

Identity

Bin Name

QR Code

Barcode

Description

Physical

Width

Depth

Height

Maximum Weight

Maximum Volume

Maximum Quantity

Operational

Current Quantity

Reserved Quantity

Available Quantity

Occupancy %

Status

Storage Role

Last Movement

Last Count Date

Last Updated By

---

# 6.8 Bin Capacity

Every Bin shall display

Current Qty

Maximum Qty

Remaining Capacity

Occupancy %

Example

Current

380 pcs

Maximum

500 pcs

Available

120 pcs

Occupancy

76%

Display both numeric and graphical representation.

---

# 6.9 Capacity Indicators

Use standard colours.

Green

0–50%

Yellow

51–75%

Orange

76–90%

Red

91–100%

Purple

Over Capacity

Grey

Empty

Colours must remain consistent across Dashboard and Warehouse Viewer.

---

# 6.10 Multiple Capacity Models

Quantity alone is insufficient.

Support

Maximum Pieces

Maximum Weight

Maximum Volume

Maximum Pallets

Maximum Bundles

Future

Custom Capacity Types

The ERP shall evaluate all configured capacity rules.

---

# 6.11 Bin Dimensions

Each Bin stores

Width

Depth

Height

Usable Volume

Maximum Weight

Future

Temperature Range

Humidity Range

Hazard Rating

---

# 6.12 Item Dimensions

Inventory Items may optionally define

Length

Width

Height

Weight

Volume

Stackable

Maximum Stack Height

Fragile

Hazardous

Future

Orientation Rules

Storage Temperature

---

# 6.13 Fit Validation

When assigning an Item to a Bin

The system should validate

Fits

Too Tall

Too Wide

Too Heavy

Insufficient Capacity

Volume Exceeded

Users may override with permission.

---

# 6.14 Multiple Items Per Bin

One Bin may contain multiple inventory items.

Example

Bin

RM-A-03-L2

PVC Resin

220 kg

Colour Additive

45 kg

Lubricant

18 kg

Occupancy

78%

Never assume one Bin equals one Item.

---

# 6.15 Bin Inventory View

Clicking a Bin opens

Bin Information

Current Inventory

Transactions

Capacity

Movement History

Reserved Stock

Transfer History

Attachments

QR Details

Everything related to the Bin should be available from one screen.

---

# 6.16 Smart Occupancy

Occupancy should always be visible.

Display

███████░░░

76%

Users should understand capacity without reading numbers.

---

# 6.17 Bin Status

Available

Occupied

Nearly Full

Full

Reserved

Blocked

Maintenance

Quality Hold

Cycle Count

Returns

Statuses drive operational workflows.

---

# 6.18 Bin Locking

Users may temporarily lock Bins.

Reasons

Maintenance

Cleaning

Cycle Count

Quality Issue

Safety

Locked Bins cannot receive inventory.

---

# 6.19 Replenishment Settings

Every Picking Bin supports

Minimum Quantity

Maximum Quantity

Target Quantity

Reorder Quantity

Replenishment Mode

Automatic

Semi Automatic

Manual

These values drive replenishment suggestions.

---

# 6.20 Replenishment Trigger

Example

Maximum

500

Minimum

150

Current

120

Dashboard automatically shows

Refill Required

Suggested Source

RM Bulk Zone

Suggested Quantity

380 pcs

One-click transfer.

---

# 6.21 Bulk Storage Relationship

Every Picking Bin may define

Primary Reserve Location

Secondary Reserve Location

Emergency Reserve Location

Example

Picking Bin

RM-P-04

Primary Source

RM Bulk Bin A12

Secondary Source

RM Bulk Bin B08

This enables intelligent replenishment.

---

# 6.22 QR & Barcode

Every Bin

Mandatory QR

Optional Barcode

Every Rack

Mandatory QR

Optional Barcode

Scanning immediately opens

Warehouse Viewer

↓

Highlighted Bin

↓

Inventory Details

↓

Available Actions

---

# 6.23 Bin Labels

System shall support printing

QR

Barcode

Rack Labels

Bin Labels

Large Labels

Small Labels

Shelf Labels

Future

Industrial Label Printers

---

# 6.24 Capacity Warnings

Dashboard shall automatically detect

Bin Full

Bin Nearly Full

Bin Empty

Over Capacity

Weight Exceeded

Volume Exceeded

Capacity warnings require no manual configuration.

---

# 6.25 Smart Suggestions

Future Ready

Suggest Better Bin

Suggest Consolidation

Suggest Empty Bin

Suggest Split Inventory

Suggest Overflow Storage

Initially rules-based.

Future AI powered.

---

# 6.26 Bin History

Every Bin maintains

Inventory History

Movement History

Transfer History

Cycle Counts

QR Scans

Status Changes

Capacity Changes

Users should understand what happened at any Bin.

---

# 6.27 Warehouse Viewer Integration

Click Rack

↓

Highlight Rack

↓

Click Bin

↓

Open Bin Details

↓

Transfer

↓

Replenish

↓

Print Label

↓

Movement History

Everything should happen without leaving the Warehouse Viewer.

---

# 6.28 Things To Avoid

DO NOT use Bins as simple text fields.

DO NOT hide occupancy.

DO NOT assume quantity is the only capacity measurement.

DO NOT restrict one Bin to one Item.

DO NOT hardcode replenishment quantities.

DO NOT require users to calculate remaining capacity manually.

DO NOT separate QR information from Bin information.

Every Bin should behave as an intelligent storage object.

---

# 6.29 Success Criteria

The Rack and Bin Management system is considered successful when

• Users instantly understand Bin occupancy.

• Capacity is always visible.

• Multiple inventory items are supported.

• Replenishment happens with minimal clicks.

• QR scanning immediately identifies the Bin.

• Warehouse staff can determine available storage without calculations.

The Rack and Bin model should become the foundation for every warehouse operation throughout ORGIN ERP.

---
# 7. Inventory Location Management & Warehouse Operations

---

# 7.1 Overview

The Inventory Location Management module connects inventory with the physical warehouse.

The purpose of this module is to allow warehouse users to efficiently assign, move, replenish and search inventory without navigating multiple screens.

Unlike traditional ERP systems where users edit one item at a time, ORGIN ERP shall provide spreadsheet-style management with intelligent automation.

---

# 7.2 Design Philosophy

The system shall answer:

• Where is this item?

• How many locations contain this item?

• Which location should I pick from?

• Which location should I replenish?

• Which location has available capacity?

Inventory location management should require the minimum number of user interactions.

---

# 7.3 Primary Functions

Item ↔ Bin Mapping

Bulk Assignment

Internal Transfers

Replenishment

Location Search

Warehouse Navigation

Inventory Consolidation

Overflow Management

---

# 7.4 Item Location Model

An inventory item may exist in multiple locations simultaneously.

Example

PVC Pipe

RM Bulk Zone

4,800 pcs

RM Picking Zone

320 pcs

Receiving Zone

900 pcs

Quality Hold

50 pcs

Dispatch Zone

700 pcs

Search shall display every location.

Never display only one location.

---

# 7.5 Primary Picking Location

Every inventory item may define

Primary Picking Bin

Primary Reserve Bin

Secondary Reserve Bin

Overflow Bin

Example

Item

PVC Pipe

Primary Picking

RM-P-03

Reserve

RM-B-18

Overflow

RM-O-02

These locations drive replenishment recommendations.

---

# 7.6 Excel Style Bulk Editor

This is the primary administration screen.

Users should never edit one item at a time.

Columns

Item

Warehouse

Floor

Zone

Rack

Bin

Primary Picking

Reserve Bin

Minimum Qty

Maximum Qty

Target Qty

Capacity Profile

Barcode

QR

Status

Every column supports inline editing.

---

# 7.7 Spreadsheet Features

Mandatory Features

Copy

Paste

Fill Down

Undo

Redo

Multi Select

Multi Edit

Keyboard Navigation

Excel Import

Excel Export

Saved Views

Column Personalisation

Advanced Filters

Grouping

Frozen Columns

Bulk Delete

Bulk Move

---

# 7.8 Drag & Drop Assignment

Users may assign inventory visually.

Workflow

Select Item

↓

Drag

↓

Drop on Bin

↓

Confirm Quantity

↓

Completed

Warehouse Viewer updates immediately.

---

# 7.9 Search Experience

Search supports

Item

Barcode

QR

Rack

Bin

Warehouse

Transaction

Supplier Lot

Batch

Search Result

Warehouse

↓

Floor

↓

Zone

↓

Rack

↓

Highlighted Bin

↓

Inventory Summary

---

# 7.10 Smart Search Results

Example

PVC Pipe

Total

5,920 pcs

Locations

RM Picking

320 pcs

RM Bulk

4,800 pcs

Receiving

800 pcs

Dispatch

0

Quality Hold

0

Every location should be clickable.

---

# 7.11 Internal Transfers

Inventory moves between locations.

Examples

Bulk

↓

Picking

Receiving

↓

Bulk

Picking

↓

Dispatch

Dispatch

↓

Returns

Quality

↓

Approved

Transfer does not change inventory quantity.

Only inventory location changes.

---

# 7.12 Replenishment Workflow

Example

Picking Bin

120 pcs

Minimum

200 pcs

Target

500 pcs

Dashboard

↓

Refill Required

Suggested Source

RM Bulk Bin A12

Suggested Quantity

380 pcs

Transfer

↓

Completed

Inventory automatically updates.

---

# 7.13 Multiple Replenishment Modes

Support

Manual

User enters quantity.

Semi Automatic

System suggests quantity.

Automatic

System creates transfer request automatically.

Future

AI Optimised Replenishment

---

# 7.14 Inventory Consolidation

Example

PVC Pipe

Bin A

40 pcs

Bin B

60 pcs

System Suggestion

Move

40 pcs

↓

Bin B

Result

One empty Bin becomes available.

This improves warehouse utilisation.

---

# 7.15 Overflow Management

If a Picking Bin reaches capacity

System suggests

Overflow Bin

Reserve Bin

Nearby Available Bin

Future

Best AI Location

---

# 7.16 Capacity Validation

Before assignment

Validate

Quantity

Weight

Volume

Dimensions

Storage Rules

Users should never accidentally exceed capacity.

---

# 7.17 Location History

Every movement shall record

Source

Destination

Quantity

Operator

Date

Time

Reason

Reference Document

No inventory movement should occur without audit history.

---

# 7.18 Warehouse Navigation

Search Item

↓

Warehouse Viewer

↓

Zoom

↓

Highlight Bin

↓

Open Bin

↓

Perform Action

Warehouse navigation should always be visual.

---

# 7.19 Things To Avoid

DO NOT edit locations item by item.

DO NOT hide secondary locations.

DO NOT allow inventory without a Bin.

DO NOT perform replenishment manually when automation is possible.

DO NOT duplicate inventory records unnecessarily.

Everything should be location-driven.

---

# 7.20 Success Criteria

Inventory Location Management is successful when

• Thousands of item locations can be managed efficiently.

• Warehouse staff locate inventory within seconds.

• Replenishment requires minimal clicks.

• Every inventory movement is fully traceable.

• Spreadsheet operations replace repetitive data entry.

The module shall become the operational backbone of warehouse execution.

---
# 8. Warehouse Viewer (2D/3D), Search, Navigation & Simulation

---

# 8.1 Overview

The Warehouse Viewer is the operational heart of the Warehouse Management System.

While the Dashboard tells users **what** requires attention, the Warehouse Viewer shows **where** the work needs to be performed.

It is the digital representation of the physical warehouse.

The Warehouse Viewer shall support both operational workflows and future visualization technologies without changing the underlying warehouse data model.

Initial implementation shall be high-performance 2D.

The architecture shall support future Three.js rendering without redesign.

---

# 8.2 Design Philosophy

Warehouse users should think visually.

They should never memorize:

• Rack Numbers

• Bin Numbers

• Warehouse Coordinates

Instead, users search an item and the Warehouse Viewer guides them to the correct physical location.

The warehouse should feel like navigating Google Maps.

---

# 8.3 Primary Responsibilities

The Warehouse Viewer shall support

Visual Navigation

Warehouse Search

Bin Inspection

Rack Inspection

Item Location

Transfer Execution

Replenishment

Cycle Count

QR Navigation

Drag & Drop

Warehouse Simulation

Future

AR Navigation

3D Navigation

---

# 8.4 Screen Layout

---------------------------------------------------------

Left Sidebar

Warehouse Tree

Search

Filters

Today's Tasks

---------------------------------------------------------

Center

Interactive Warehouse Canvas

---------------------------------------------------------

Right Sidebar

Selected Object

Inventory

Actions

History

Properties

---------------------------------------------------------

Bottom (Optional)

Status Bar

Coordinates

Zoom

Occupancy

Selection

---

# 8.5 Navigation Hierarchy

Warehouse

↓

Floor

↓

Zone

↓

Layout

↓

Rack

↓

Bin

Users may expand or collapse each level.

Changing floors shall immediately refresh the canvas.

---

# 8.6 Interactive Canvas

The canvas supports

Zoom

Pan

Fit To Screen

Reset View

Grid Toggle

Snap To Grid

Selection Box

Mini Map

Dark Mode (Future)

---

# 8.7 Warehouse Rendering

Phase 1

High-performance 2D Canvas

Future

Three.js

The rendering engine shall remain independent from warehouse business logic.

---

# 8.8 Search Workflow

User searches

PVC Pipe

↓

Warehouse Viewer opens

↓

Ground Floor

↓

RM Picking Zone

↓

Rack A

↓

Bin A-03-L2

↓

Bin flashes with animated pulse

↓

Inventory panel opens automatically

Users should never manually navigate after searching.

---

# 8.9 Search Highlight Animation

When an item is found

The destination Bin shall

Glow

Pulse

Zoom Into View

Remain highlighted until dismissed

Animation should be subtle and professional.

Avoid excessive visual effects.

---

# 8.10 Search Filters

Warehouse

Floor

Zone

Storage Role

Item

Batch

Lot

Expiry

Bin Status

Occupancy

Capacity

Users may combine multiple filters.

---

# 8.11 Warehouse Tree

The left panel displays

Warehouse

Floor

Zone

Layout

Rack

Bin

Clicking any object immediately centers it in the viewer.

---

# 8.12 Visual Colours

Warehouse Colours shall remain consistent throughout the ERP.

Green

Available

Yellow

Partially Occupied

Orange

Nearly Full

Red

Full

Blue

Reserved

Purple

Quality Hold

Grey

Inactive

Never use different colours for the same status.

---

# 8.13 Click Behaviour

Click Warehouse

↓

Overview

Click Floor

↓

Floor View

Click Zone

↓

Zone Overview

Click Rack

↓

Rack Details

Click Bin

↓

Bin Details

Navigation should always preserve context.

---

# 8.14 Bin Information Panel

Selecting a Bin displays

Bin Name

QR Code

Barcode

Current Inventory

Capacity

Occupancy

Reserved Quantity

Last Movement

Last Count

Status

Actions

Everything related to the Bin should be available from one panel.

---

# 8.15 Rack Information

Selecting a Rack displays

Rack Details

Dimensions

Total Capacity

Occupied Bins

Available Bins

QR

Barcode

Inspection History

Maintenance Status

---

# 8.16 Visual Inventory

Inventory inside a Bin should be visually represented.

Example

Bin A-03

████████░░

380 / 500 pcs

Items

PVC Pipe

220 pcs

Reducer

60 pcs

Valve

100 pcs

This allows users to understand inventory without opening multiple screens.

---

# 8.17 Drag & Drop Operations

Users may drag

Inventory

↓

Bin

Rack

↓

New Position

Layout

↓

New Position

The system validates

Capacity

Storage Rules

Weight

Dimensions

Before completing the operation.

---

# 8.18 Warehouse Search Modes

Support

Search Item

Search Rack

Search Bin

Search QR

Search Barcode

Search Batch

Search Lot

Search Transaction

Search Results should always open visually.

---

# 8.19 QR Navigation

Workflow

Scan QR

↓

Warehouse Viewer Opens

↓

Automatically Zoom

↓

Highlight Rack

↓

Highlight Bin

↓

Open Details

No manual searching required.

---

# 8.20 Live Occupancy

Every Bin shall display

Current Quantity

Maximum Quantity

Occupancy %

Colour

Hovering displays

Remaining Capacity

Weight

Volume

Last Movement

---

# 8.21 Simulation Mode

The Warehouse Viewer shall support Simulation Mode before layouts are published.

Simulation allows administrators to validate warehouse designs.

Simulation never changes inventory.

---

# 8.22 Simulation Features

Support

Search Simulation

Picking Simulation

Replenishment Simulation

Capacity Simulation

Transfer Simulation

Emergency Route Simulation (Future)

---

# 8.23 Search Simulation

Administrator enters

PVC Pipe

System demonstrates

Navigation

↓

Rack

↓

Bin

↓

Highlight

Purpose

Validate warehouse navigation before deployment.

---

# 8.24 Picking Simulation

Administrator selects

Sales Order

System calculates

Picking Sequence

Walking Path

Estimated Distance

Estimated Time

Future

Shortest Path Optimization

---

# 8.25 Replenishment Simulation

System identifies

Low Picking Bin

↓

Reserve Bin

↓

Suggested Transfer

Administrator validates

Distance

Capacity

Efficiency

Before publishing.

---

# 8.26 Capacity Simulation

Administrator adjusts

Bin Size

↓

Occupancy

↓

Layout

System estimates

Storage Utilization

Overflow

Available Capacity

Future Growth

---

# 8.27 Layer Controls

Users may show or hide

Rack Labels

Bin Labels

QR Icons

Occupancy

Heat Map

Storage Roles

Transfer Routes

Picking Routes

Future

RFID Signals

IoT Sensors

---

# 8.28 Heat Map

Warehouse Heat Map shall support

Occupancy

Picking Frequency

Transfer Frequency

Congestion

Unused Storage

Colour intensity represents activity.

---

# 8.29 Future Three.js

Three.js shall provide

Walkthrough

Orbit Camera

Fly Mode

Rack Height

Realistic Shelving

Lighting

Animated Picking

Future Digital Twin

Business logic shall remain identical.

---

# 8.30 Things To Avoid

DO NOT make users manually browse warehouses.

DO NOT separate search from visualization.

DO NOT require multiple windows.

DO NOT overload the interface with engineering controls.

DO NOT mix Designer functions into the Viewer.

Designer builds the warehouse.

Viewer operates the warehouse.

---

# 8.31 Success Criteria

The Warehouse Viewer is considered successful when

• Users locate inventory within seconds.

• Search always opens the correct location.

• Warehouse navigation feels natural.

• Operators perform warehouse work visually rather than by remembering location codes.

• Future 3D rendering can be added without changing the warehouse architecture.

The Warehouse Viewer shall become the digital twin of the physical warehouse.

---
# 9. Stock Movements, Replenishment Engine & Internal Transfer Management

---

# 9.1 Overview

Inventory is valuable only when it is in the correct location at the correct time.

The Stock Movement Engine is responsible for moving inventory throughout the warehouse while maintaining complete traceability.

The system shall support intelligent inventory movement between all warehouse locations while minimizing manual effort.

The movement engine shall become the operational backbone of warehouse execution.

---

# 9.2 Design Philosophy

Warehouse operators should never ask

"Where should I move this?"

Instead, the system should recommend

• Best Source Location

• Best Destination Location

• Suggested Quantity

• Suggested Route

• Suggested Priority

Users approve.

The ERP performs the rest.

---

# 9.3 Supported Movement Types

The movement engine shall support

Receiving

Put-away

Internal Transfer

Replenishment

Picking

Dispatch

Returns

Quality Hold

Quality Release

Bin Consolidation

Overflow Movement

Cycle Count Adjustment

Manual Relocation

Every movement type shall use the same movement engine.

---

# 9.4 Warehouse Movement Flow

Receiving

↓

Receiving Zone

↓

Bulk Storage

↓

Picking Zone

↓

Dispatch Zone

↓

Customer

Returns

↓

Returns Zone

↓

Inspection

↓

Approved Storage

OR

Quality Hold

This workflow shall remain configurable.

---

# 9.5 Bulk Storage & Picking Philosophy

Every manufacturing warehouse typically contains two storage purposes.

## Bulk Storage

Purpose

Long-term inventory.

Characteristics

High Capacity

Less Frequently Accessed

Reserve Stock

Large Bags

Pallets

Bulk Material

Example

PVC Resin Bags

Pipe Bundles

Large Cartons

---

## Picking Storage

Purpose

Daily production consumption.

Characteristics

Smaller quantities

Fast access

Frequently replenished

Production-facing

The production team should consume inventory only from Picking locations whenever possible.

---

# 9.6 Replenishment Engine

The ERP continuously monitors Picking Bins.

Every Picking Bin may define

Minimum Quantity

Maximum Quantity

Target Quantity

Current Quantity

Primary Reserve Bin

Secondary Reserve Bin

The system automatically determines when replenishment is required.

---

# 9.7 Replenishment Trigger

Example

Picking Bin

Current

120 kg

Minimum

200 kg

Maximum

500 kg

Target

500 kg

System detects

Current < Minimum

Dashboard automatically displays

Refill Required

Suggested Quantity

380 kg

Suggested Source

Bulk Bin A12

---

# 9.8 Replenishment Modes

Manual

Warehouse operator decides everything.

Semi Automatic

System recommends.

User confirms.

Automatic

ERP automatically creates Internal Transfer Requests.

Future

AI Optimized

Based on production forecast.

---

# 9.9 Intelligent Source Selection

When multiple Bulk Bins contain the same inventory

The ERP shall recommend

Nearest Bin

Highest Available Quantity

FIFO

FEFO

Least Walking Distance

Lowest Congestion

Rules shall remain configurable.

---

# 9.10 Internal Transfer

Internal Transfers move inventory between warehouse locations.

Examples

RM Bulk

↓

RM Picking

FG Picking

↓

Dispatch

Receiving

↓

Bulk Storage

Returns

↓

Inspection

Inspection

↓

Approved Storage

Transfer never changes inventory quantity.

Only location changes.

---

# 9.11 Internal Transfer Workflow

Create Transfer

↓

Validate

↓

Approve (Optional)

↓

Pick Inventory

↓

Move Inventory

↓

Confirm Receipt

↓

Complete

Every step shall be auditable.

---

# 9.12 Transfer Priorities

Low

Normal

High

Urgent

Critical

Dashboard should sort accordingly.

---

# 9.13 Transfer Status

Draft

Requested

Approved

Picking

In Transit

Received

Completed

Cancelled

Rejected

Users shall always know where a transfer is.

---

# 9.14 Production Refill Workflow

This workflow is mandatory.

Bulk Storage

↓

Large Bag

↓

Picking Bin

↓

Production Consumption

Example

Bulk Zone

PVC Resin Bag

25 kg

↓

Picking Bin

↓

Production consumes

↓

Picking quantity drops

↓

Dashboard shows

Refill Required

↓

Warehouse operator refills Picking Bin

↓

Bulk Bag quantity reduces automatically

This workflow shall require no duplicate inventory entries.

---

# 9.15 Bulk Container Management

Bulk inventory may exist as

Bag

Bundle

Pallet

Drum

Roll

Box

Container

Future

Custom Packaging Types

Each Bulk Container stores

Current Quantity

Original Quantity

Remaining Quantity

Current Location

Status

Users should always know where partially used containers are located.

---

# 9.16 Put-away Suggestions

Receiving inventory should not require users to manually select locations.

The ERP recommends

Nearest Empty Bin

Correct Storage Role

Available Capacity

Suitable Dimensions

Weight Capacity

Storage Rules

User may override.

---

# 9.17 Bin Consolidation

Example

Bin A

15%

Bin B

20%

ERP suggests

Move Bin A

↓

Bin B

Result

One empty Bin becomes available.

Warehouse utilization improves.

---

# 9.18 Overflow Management

When preferred locations are full

ERP recommends

Overflow Bin

Secondary Picking Bin

Reserve Bin

Temporary Storage

Future AI recommendations

---

# 9.19 Transfer Validation

Before transfer

Validate

Capacity

Dimensions

Weight

Volume

Blocked Bin

Reserved Bin

Quality Hold

Users should never accidentally create invalid transfers.

---

# 9.20 Mobile Workflow

Warehouse operator

↓

Scan Source Bin

↓

Scan Item

↓

Confirm Quantity

↓

Scan Destination Bin

↓

Transfer Complete

The mobile workflow shall minimize typing.

---

# 9.21 Dashboard Integration

Dashboard shall automatically display

Pending Transfers

Delayed Transfers

Replenishment Queue

Receiving Queue

Dispatch Queue

Transfer Aging

No separate report should be required for daily monitoring.

---

# 9.22 Notifications

Notify when

Transfer Delayed

Transfer Completed

Picking Bin Below Minimum

Bulk Storage Empty

Destination Bin Full

Transfer Failed

Notifications shall include one-click navigation.

---

# 9.23 Complete Audit Trail

Every movement records

Movement Type

Reference Document

Source

Destination

Operator

Date

Time

Device

Remarks

Approval History

No stock movement shall occur without audit history.

---

# 9.24 Things To Avoid

DO NOT force users to manually search for reserve inventory.

DO NOT duplicate inventory during transfers.

DO NOT allow inventory to exist without a physical location.

DO NOT require warehouse operators to calculate replenishment quantities.

DO NOT hardcode warehouse names.

Always use Storage Roles.

---

# 9.25 Success Criteria

The Stock Movement Engine is considered successful when

• Warehouse operators complete transfers with minimal clicks.

• Picking locations are automatically replenished.

• Reserve inventory is always traceable.

• Every movement is fully auditable.

• Warehouse users always know the best source and destination locations.

The movement engine shall become the central execution layer for all warehouse inventory movements.

---


Phase 0
Foundation
        │
        ▼
Phase 1
Warehouse Designer
        │
        ▼
Phase 2
Warehouse Viewer
        │
        ▼
Phase 3
Inventory Mapping
        │
        ▼
Phase 4
Warehouse Operations
        │
        ▼
Phase 5
Dashboard
        │
        ▼
Phase 6
Mobile Warehouse
        │
        ▼
Phase 7
Cycle Count
        │
        ▼
Phase 8
Analytics & Intelligence
        │
        ▼
Phase 9
Enterprise Features
        │
        ▼
Phase 10
Future Roadmap