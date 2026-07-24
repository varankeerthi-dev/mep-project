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
}

export interface OrganisationInfoData {
  name: string;
  gstin: string;
  pan: string;
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
