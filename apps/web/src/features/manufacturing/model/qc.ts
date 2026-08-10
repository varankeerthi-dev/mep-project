export interface QCParameter {
  id?: string;
  bom_id?: string | null;
  product_id?: string | null;
  parameter_name: string;
  specification: string;
  measurement_unit?: string;
  test_method?: string;
  aql_level: string;
  severity: 'critical' | 'major' | 'minor';
  is_active: boolean;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface FGQCInspection {
  id?: string;
  inspection_no: string;
  production_entry_id?: string | null;
  job_card_id?: string | null;
  product_id: string;
  batch_no: string;
  produced_qty: number;
  sample_size?: number;
  accepted_qty: number;
  rejected_qty: number;
  rework_qty: number;
  inspection_date: string;
  inspector_id?: string | null;
  inspection_result: 'pending' | 'accepted' | 'partially_accepted' | 'rejected';
  defect_categories?: Array<{ category: string; count: number; severity: string }>;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface QCParameterResult {
  id?: string;
  inspection_id: string;
  parameter_id: string;
  measured_value?: string;
  is_pass: boolean;
  remarks?: string;
  created_at?: string;
}

export interface RMQCInspection {
  id?: string;
  grn_id: string;
  inspection_no: string;
  inspector_id?: string | null;
  inspection_date: string;
  result: 'pending' | 'passed' | 'failed' | 'conditional';
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}
