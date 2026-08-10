export interface IPQCCheckpoint {
  id?: string;
  bom_id: string;
  sequence: number;
  checkpoint_name: string;
  checkpoint_type: 'mandatory' | 'optional';
  parameter_definitions: Array<{ name: string; spec: string; unit?: string; severity?: string }>;
  organisation_id: string;
  created_at?: string;
}

export interface IPQCInspection {
  id?: string;
  job_card_id: string;
  checkpoint_id: string;
  inspector_id?: string | null;
  inspection_date?: string;
  result: 'pending' | 'passed' | 'failed' | 'conditional';
  parameter_results: Array<{ name: string; measured_value?: string; is_pass: boolean }>;
  sampled_qty?: number;
  total_batch_qty?: number;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
}
