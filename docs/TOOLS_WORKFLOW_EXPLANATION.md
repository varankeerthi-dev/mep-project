# Tools Management Workflow - Complete Guide

## 🎯 Overview
The Tools Management System provides complete control over tool movement across your organization with four main workflows:

1. **Issue Tools** - Warehouse → Site/Client
2. **Receive Tools** - Site/Client → Warehouse  
3. **Transfer Tools** - Client → Client
4. **Site Transfer** - Site → Site

---

## 📦 1. ISSUE TOOLS WORKFLOW
**Purpose**: Distribute tools from warehouse to project sites or clients

### 🔄 Process Flow
```
START → Select Tools → Choose Client → Specify Source → Generate DC → Update Stock → END
```

### 📋 Step-by-Step

#### Step 1: Access Issue Tools
- Navigate to **Projects → Tools → Issue Tools**
- Auto-generated Reference ID appears (ORG001-12345)

#### Step 2: Select Tools
- **Tool Name**: Dropdown from tools catalog
- **Make**: Auto-populated from catalog (user can hide/unhide)
- **Quantity**: Number of units to issue
- **Add Tool**: Button to add multiple tools

#### Step 3: Specify Source Location
- **Tool Source Place**: Dropdown with options:
  - Warehouse (default)
  - Main Office
  - Central Store
  - Regional Hub
- **Display**: "TOOL SOURCE: [Selected Place]" above tools table

#### Step 4: Client Information
- **Client**: Dropdown from existing client database
- **Taken By**: Employee name receiving tools
- **Remarks**: Special instructions or notes

#### Step 5: Submit & Generate DC
- **Submit Button**: Creates transaction and updates stock
- **Loading Spinner**: Shows during processing
- **Success Message**: Confirmation with PDF download option
- **PDF Generation**: Classic Tools Delivery Challan

### 📊 Stock Impact
```
Warehouse Stock:    -5 units
Client Stock:        +5 units
Transaction Status:   ACTIVE
```

---

## 🔄 2. RECEIVE TOOLS WORKFLOW
**Purpose**: Return tools from sites/clients back to warehouse

### 🔄 Process Flow
```
START → Search Reference → Verify Tools → Update Condition → Stock Return → END
```

### 📋 Step-by-Step

#### Step 1: Access Receive Tools
- Navigate to **Projects → Tools → Receive Tools**
- **Reference ID Search**: Auto-complete for existing DC numbers

#### Step 2: Auto-Populate Details
- **Client Name**: Auto-filled from original transaction
- **Tools List**: Auto-populated with issued tools
- **Issued Date**: Original issue date displayed

#### Step 3: Update Return Information
- **Received Quantity**: Editable (can be partial return)
- **Condition Notes**: Tool condition on return
- **Received By**: Employee name receiving tools
- **Return Date**: Current date

#### Step 4: Submit & Update
- **Submit Button**: Processes return and updates stock
- **Partial Returns**: Updates remaining quantity at client
- **Complete Returns**: Marks all tools as returned to warehouse

### 📊 Stock Impact
```
Warehouse Stock:    +3 units (partial return)
Client Stock:        -3 units (partial return)
Transaction Status:   PARTIAL RETURNED
```

---

## 🔄 3. TRANSFER TOOLS WORKFLOW
**Purpose**: Move tools directly between clients without warehouse involvement

### 🔄 Process Flow
```
START → Select Source Client → Select Destination Client → Choose Tools → Transfer → END
```

### 📋 Step-by-Step

#### Step 1: Access Transfer Tools
- Navigate to **Projects → Tools → Transfer Tools**
- **Reference ID**: Auto-generated new number

#### Step 2: Client Selection
- **From Client**: Dropdown (cannot be same as destination)
- **To Client**: Dropdown (cannot be same as source)
- **Validation**: System prevents same-client transfers

#### Step 3: Tool Selection
- **Available Tools**: Shows only tools at source client
- **Quantity**: Limited to available stock
- **Reason for Transfer**: Text area explaining transfer purpose

#### Step 4: Authorization & Transfer
- **Approved By**: Manager authorization (if required)
- **Transfer Date**: Current date
- **Submit**: Creates audit trail for both clients

### 📊 Stock Impact
```
Source Client Stock:  -2 units
Destination Client:    +2 units
Warehouse Stock:      No change
Transaction Status:    ACTIVE
```

---

## 🔄 4. SITE TRANSFER WORKFLOW
**Purpose**: Move tools directly between project sites without warehouse involvement

### 🔄 Process Flow
```
START → Select Source Site → Select Destination Site → Choose Tools → Transfer → END
```

### 📋 Step-by-Step

#### Step 1: Access Site Transfer
- Navigate to **Projects → Tools → Site Transfer**
- **Reference ID**: Auto-generated new number

#### Step 2: Site Selection
- **From Project**: Dropdown of active project sites
- **From Site Address**: Auto-populated from project details
- **To Project**: Dropdown (cannot be same as source)
- **To Site Address**: Auto-populated from project details

#### Step 3: Tool Selection
- **Available Tools**: Shows only tools at source project
- **Quantity**: Limited to available stock at source
- **Vehicle Number**: Optional tracking information

#### Step 4: Transfer Execution
- **Transferred By**: Employee name at source site
- **Received By**: Employee name at destination site
- **Reason for Transfer**: Project requirement explanation
- **Status**: Initially "IN_TRANSIT", then "COMPLETED"

### 📊 Stock Impact
```
Source Project Stock:   -1 unit
Destination Project:    +1 unit
Warehouse Stock:       No change
Transaction Status:     COMPLETED
```

---

## 📊 5. TOOLS DASHBOARD

### 📈 Real-time Metrics
- **Total Tools in Catalog**: All registered tools
- **Tools Currently at Clients/Sites**: Active tools outside warehouse
- **Tools Available in Warehouse**: Current warehouse stock
- **Tools in Transit**: Pending transfers and site transfers
- **Overdue Returns**: Tools that should have been returned

### 🔄 Recent Activity
- **Last 10 Transactions**: All types of tool movements
- **Pending Returns**: Tools expected back from sites
- **Recent Transfers**: Both client and site transfers
- **Pending Site Transfers**: Tools in transit between sites

### ⚡ Quick Actions
- **Issue Tools**: Start warehouse → site workflow
- **Receive Tools**: Start site → warehouse workflow
- **Transfer Tools**: Start client → client workflow
- **Site Transfer**: Start site → site workflow

---

## 📋 6. TOOL HISTORY & SEARCH

### 🔍 Search Capabilities
- **Date Range**: Filter by transaction period
- **Client/Project**: Multi-select dropdown
- **Transaction Type**: Issue/Receive/Transfer/Site Transfer
- **Status**: Active/Returned/Partial/In Transit
- **Reference ID**: Text search for specific transactions
- **Tool Name**: Search for specific tools

### 📊 History Table Columns
- **Reference ID**: Unique transaction identifier
- **Date**: Transaction date
- **Client/Project Name**: Source or destination
- **Transaction Type**: Type of movement
- **Tool Details**: Tools involved in transaction
- **Status**: Current state of tools
- **Actions**: View/Edit/Download PDF

---

## 📄 7. PDF GENERATION

### 📋 Classic Tools Delivery Challan
- **Template**: Based on Classic Quotation Template
- **Header**: "DELIVERY CHALLAN" (fixed title)
- **Organization**: Logo and details
- **Tool Source**: Displayed above tools table
- **MAKE Column**: User-controllable visibility
- **HSN Codes**: GST compliance support
- **Signatures**: Issued by and Received by sections

### 🎛 Template Settings Control
- **Column Visibility**: Show/hide specific columns
- **Tool Source**: Make column control
- **Layout Options**: Page size, orientation
- **Content Options**: Bank details, terms, signatures

---

## 🔄 8. STOCK MANAGEMENT

### 📊 Real-time Tracking
- **Warehouse Stock**: Central inventory
- **Client Stock**: Tools at client locations
- **Project Stock**: Tools at project sites
- **In Transit**: Tools being transferred

### 🔄 Automatic Updates
- **Issue Tools**: Reduces warehouse, increases client stock
- **Receive Tools**: Increases warehouse, reduces client stock
- **Transfer Tools**: Updates both client stocks
- **Site Transfer**: Updates both project stocks

### 📈 Stock Reports
- **Current Levels**: Real-time stock at all locations
- **Movement History**: Complete audit trail
- **Low Stock Alerts**: When tools reach minimum levels
- **Utilization Reports**: Tool usage patterns

---

## 🎯 9. BUSINESS RULES & VALIDATIONS

### ✅ Universal Rules
- **Reference IDs**: Unique per organisation
- **Stock Validation**: Cannot issue more than available
- **Location Validation**: Cannot transfer to same location
- **Required Fields**: All mandatory fields must be filled

### 🔄 Workflow-Specific Rules
- **Issue Tools**: Must have sufficient warehouse stock
- **Receive Tools**: Reference ID must exist
- **Transfer Tools**: Source client must have tools
- **Site Transfer**: Both projects must be active

### 🔒 Security & Access
- **Role-Based Access**: Different permissions per user role
- **Organization Isolation**: Data separated by organisation
- **Audit Trail**: Complete transaction history
- **Approval Workflows**: Manager approval for high-value tools

---

## 🚀 10. INTEGRATION POINTS

### 📦 Purchase Order Integration
- **Tool Procurement**: PO completion auto-adds to tools catalog
- **Stock Updates**: Automatic stock increase on PO completion
- **Vendor Management**: Tool-specific vendor categories

### 🏗️ Project Integration
- **Project Sites**: Tools linked to active projects
- **Site Addresses**: Auto-populated from project details
- **Resource Planning**: Tools allocation per project

### 💰 Financial Integration
- **Tool Valuation**: Purchase price and depreciation
- **GST Compliance**: HSN codes and tax calculations
- **Cost Tracking**: Tool costs per project/client

---

## 📞 SUPPORT & TROUBLESHOOTING

### 🔧 Common Issues
- **Stock Mismatches**: Check transaction history
- **Missing Tools**: Use search with reference ID
- **Transfer Failures**: Verify destination availability
- **PDF Generation**: Clear browser cache if issues

### 📞 Help Resources
- **Tool History**: Complete audit trail for investigations
- **Search Function**: Find any transaction quickly
- **Dashboard Metrics**: Real-time status overview
- **Template Settings**: Customize PDF layouts

---

## 🎉 SUMMARY

The Tools Management System provides:
- **Complete Control**: Full visibility of all tool movements
- **Flexibility**: Four different transfer workflows
- **Automation**: Stock updates and PDF generation
- **Compliance**: GST support and audit trails
- **Integration**: Seamless connection with existing systems

This comprehensive system ensures tools are always tracked, properly allocated, and efficiently managed across your entire organization.
