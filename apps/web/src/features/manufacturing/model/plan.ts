export interface WorkCenter {
  id?: string;
  name: string;
  code: string;
  work_center_type: 'machine' | 'assembly_line' | 'workstation';
  capacity_per_hour: number;
  capacity_uom: string;
  hours_per_shift: number;
  shifts_per_day: number;
  is_active: boolean;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductionPlan {
  id?: string;
  plan_no: string;
  plan_period_start: string;
  plan_period_end: string;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  remarks?: string;
  created_by?: string | null;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductionPlanItem {
  id?: string;
  plan_id: string;
  product_id: string;
  product_name: string;
  bom_id?: string | null;
  demand_qty: number;
  current_fg_stock: number;
  wip_qty: number;
  net_to_produce: number;
  planned_qty: number;
  linked_sales_orders?: Array<{ order_id: string; order_no: string; qty: number; due_date: string }>;
  linked_schedule_id?: string | null;
  linked_job_card_ids?: string[];
  status: 'pending' | 'scheduled' | 'in_production' | 'fulfilled';
  organisation_id: string;
  created_at?: string;
}
