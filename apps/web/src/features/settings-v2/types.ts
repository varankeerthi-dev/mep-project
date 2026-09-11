import React from 'react';

export type SettingsCategory = 
  | 'Organisation'
  | 'Documents'
  | 'Commerce'
  | 'Advanced'
  | 'Master Data';

export interface SettingsTabDefinition {
  id: string;
  label: string;
  category: SettingsCategory;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description?: string;
  searchIndex: string[];
}

export interface GeneralConfigData {
  round_off_enabled: boolean;
  auto_generate_item_codes: boolean;
  date_format: string;
}

export interface OrganisationInfoData {
  name: string;
  gstin: string;
  pan: string;
  tan: string;
  msme_no: string;
  website: string;
  state: string;
  logo_url: string;
  address_line1: string;
  address_line2: string;
  city_state_pincode: string;
  phone: string;
  email: string;
}

export interface DocumentNumberSeries {
  id: string;
  doc_type: string;
  label: string;
  prefix: string;
  start_number: number;
  padding: number;
  suffix: string;
  prevent_duplicate: boolean;
}

export interface ToolsConfigData {
  default_location: string;
  stock_alerts_enabled: boolean;
  min_stock_level: number;
  default_pdf_template: string;
  show_make_column: boolean;
  show_hsn_column: boolean;
}

export interface SettingsTabContract<T = any> {
  load?: () => Promise<void>;
  snapshot?: () => T;
  hasChanges: () => boolean;
  save: () => Promise<void>;
  discard: () => void;
  reset?: (initialData?: T) => void;
  validate?: () => Promise<{ isValid: boolean; errors?: Record<string, string> } | boolean>;
}


import {
  Building2,
  Sliders,
  Users,
  Hash,
  FileText,
  Printer,
  Percent,
  Zap,
  ShieldCheck,
  Workflow,
  FolderTree,
  Ruler,
  Layers,
  Warehouse,
  FileCode,
  Wrench,
} from 'lucide-react';

export const SETTINGS_TABS: SettingsTabDefinition[] = [
  // Organisation
  {
    id: 'general',
    label: 'General & Config',
    category: 'Organisation',
    icon: Sliders,
    description: 'System-wide preferences, calculation rounding, and auto-generation',
    searchIndex: ['general', 'config', 'round off', 'rounding', 'integer rounding', 'item code generation'],
  },
  {
    id: 'organisation',
    label: 'Organisation Info',
    category: 'Organisation',
    icon: Building2,
    description: 'Company identity, tax registration, address, and branding',
    searchIndex: ['organisation', 'company', 'gst', 'gstin', 'pan', 'logo', 'address', 'phone', 'email'],
  },
  {
    id: 'team-members',
    label: 'Team Members',
    category: 'Organisation',
    icon: Users,
    description: 'User access levels, team roles, and invitations',
    searchIndex: ['team members', 'users', 'roles', 'employee', 'invite', 'access'],
  },

  // Documents
  {
    id: 'numbering-series',
    label: 'Numbering Series',
    category: 'Documents',
    icon: Hash,
    description: 'Transaction prefixes, start numbers, zero padding, and duplicate prevention',
    searchIndex: [
      'numbering series',
      'document numbers',
      'prefix',
      'suffix',
      'padding',
      'start number',
      'quotation prefix',
      'invoice prefix',
      'po prefix',
      'prevent duplicate numbers',
    ],
  },
  {
    id: 'document-templates',
    label: 'Document Templates',
    category: 'Documents',
    icon: FileText,
    description: 'Custom PDF templates, layout columns, and labels',
    searchIndex: ['document templates', 'templates', 'pdf template', 'columns', 'labels', 'custom template'],
  },
  {
    id: 'print-layouts',
    label: 'Print Layouts',
    category: 'Documents',
    icon: Printer,
    description: 'Printer defaults, page size, orientation, and margins',
    searchIndex: ['print layouts', 'print', 'printer', 'page size', 'orientation', 'margins', 'a4'],
  },

  // Commerce
  {
    id: 'discounts',
    label: 'Discount Settings',
    category: 'Commerce',
    icon: Percent,
    description: 'Default, minimum, and maximum discount percentage rules by variant',
    searchIndex: ['discount settings', 'discount rules', 'min discount', 'max discount', 'margin'],
  },
  {
    id: 'quick-quote',
    label: 'Quick Quote',
    category: 'Commerce',
    icon: Zap,
    description: 'Quick estimation matrix, standard size pricing, and defaults',
    searchIndex: ['quick quote', 'quote matrix', 'size pricing', 'estimation defaults'],
  },

  // Advanced
  {
    id: 'modules',
    label: 'Module Management',
    category: 'Advanced',
    icon: ShieldCheck,
    description: 'Enable or disable feature modules across the application',
    searchIndex: ['modules', 'module management', 'feature toggles', 'enable module'],
  },
  {
    id: 'approvals',
    label: 'Approval Workflows',
    category: 'Advanced',
    icon: Workflow,
    description: 'Multi-level approval authorization rules, thresholds, and reviewers',
    searchIndex: [
      'approval workflows',
      'approvals',
      'workflow',
      'approver',
      'reviewer',
      'purchase payment',
      'subcontractor payment',
      'payment request',
      'quotation',
      'work order',
      'purchase order',
      'sales order',
      'job card',
      'site expense',
    ],
  },
  {
    id: 'tools',
    label: 'Tools & Equipment',
    category: 'Advanced',
    icon: Wrench,
    description: 'Tools configuration, serial generation, and calibration defaults',
    searchIndex: ['tools', 'equipment', 'tools settings', 'calibration'],
  },

  // Master Data
  {
    id: 'categories',
    label: 'Item Categories',
    category: 'Master Data',
    icon: FolderTree,
    description: 'Item taxonomy and classification hierarchy',
    searchIndex: ['categories', 'item categories', 'taxonomy', 'classification'],
  },
  {
    id: 'units',
    label: 'Units of Measure',
    category: 'Master Data',
    icon: Ruler,
    description: 'UOM definitions, symbols, and decimal precision',
    searchIndex: ['units of measure', 'uom', 'units', 'kg', 'nos', 'meters', 'decimal'],
  },
  {
    id: 'variants',
    label: 'Variants & Discount Cats',
    category: 'Master Data',
    icon: Layers,
    description: 'Product variants and discount category assignments',
    searchIndex: ['variants', 'discount categories', 'product variants', 'company variants'],
  },
  {
    id: 'warehouses',
    label: 'Warehouses & Locations',
    category: 'Master Data',
    icon: Warehouse,
    description: 'Inventory storage locations and godowns',
    searchIndex: ['warehouses', 'locations', 'godown', 'storage', 'inventory site'],
  },
  {
    id: 'terms-conditions',
    label: 'Terms & Conditions',
    category: 'Master Data',
    icon: FileCode,
    description: 'Standard clause templates for quotations, invoices, and POs',
    searchIndex: ['terms & conditions', 'terms', 'conditions', 'legal terms', 'contract clauses'],
  },
];
