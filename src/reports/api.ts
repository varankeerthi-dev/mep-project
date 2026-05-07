import { supabase } from '../supabase';

// ========================================
// REPORT TEMPLATES
// ========================================

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'financial' | 'projects' | 'inventory' | 'compliance';
  template_config: Record<string, any>;
  created_by?: string;
  organisation_id?: string;
  is_system_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportParameter {
  id: string;
  template_id: string;
  parameter_name: string;
  parameter_type: 'date-range' | 'multi-select' | 'single-select' | 'text' | 'number';
  parameter_config: Record<string, any>;
  default_value?: any;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export const getReportTemplates = async (category?: string, organisationId?: string) => {
  let query = supabase
    .from('report_templates')
    .select(`
      *,
      report_parameters(*)
    `)
    .eq('is_system_template', true);

  if (category) {
    query = query.eq('category', category);
  }

  if (organisationId) {
    query = query.or(`is_system_template.eq.true,organisation_id.eq.${organisationId}`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data as (ReportTemplate & { report_parameters: ReportParameter[] })[];
};

export const getReportTemplateById = async (templateId: string) => {
  const { data, error } = await supabase
    .from('report_templates')
    .select(`
      *,
      report_parameters(*)
    `)
    .eq('id', templateId)
    .single();

  if (error) throw error;
  return data as (ReportTemplate & { report_parameters: ReportParameter[] });
};

export const createReportTemplate = async (template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('report_templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data as ReportTemplate;
};

// ========================================
// GENERATED REPORTS
// ========================================

export interface GeneratedReport {
  id: string;
  template_id: string;
  report_name: string;
  report_type: string;
  parameters: Record<string, any>;
  data: Record<string, any>;
  file_path?: string;
  file_size?: number;
  file_format?: 'pdf' | 'excel' | 'csv';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string;
  generated_by: string;
  organisation_id: string;
  generated_at: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export const generateReport = async (
  templateId: string,
  reportName: string,
  parameters: Record<string, any>,
  organisationId: string,
  userId: string
) => {
  const { data, error } = await supabase
    .from('generated_reports')
    .insert({
      template_id: templateId,
      report_name: reportName,
      report_type: 'custom',
      parameters,
      status: 'pending',
      generated_by: userId,
      organisation_id: organisationId
    })
    .select()
    .single();

  if (error) throw error;
  return data as GeneratedReport;
};

export const getGeneratedReports = async (
  organisationId: string,
  filters?: {
    category?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
  }
) => {
  let query = supabase
    .from('generated_reports')
    .select(`
      *,
      report_templates(name, category)
    `)
    .eq('organisation_id', organisationId);

  if (filters?.category) {
    query = query.eq('report_templates.category', filters.category);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.dateFrom) {
    query = query.gte('generated_at', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('generated_at', filters.dateTo);
  }

  if (filters?.userId) {
    query = query.eq('generated_by', filters.userId);
  }

  const { data, error } = await query.order('generated_at', { ascending: false });

  if (error) throw error;
  return data as (GeneratedReport & { report_templates: { name: string; category: string } })[];
};

export const getGeneratedReportById = async (reportId: string) => {
  const { data, error } = await supabase
    .from('generated_reports')
    .select(`
      *,
      report_templates(*),
      auth_users(email)
    `)
    .eq('id', reportId)
    .single();

  if (error) throw error;
  return data;
};

export const updateReportStatus = async (
  reportId: string,
  status: GeneratedReport['status'],
  data?: Partial<GeneratedReport>
) => {
  const updateData: Partial<GeneratedReport> = { status, ...data };

  const { data: result, error } = await supabase
    .from('generated_reports')
    .update(updateData)
    .eq('id', reportId)
    .select()
    .single();

  if (error) throw error;
  return result as GeneratedReport;
};

export const deleteReport = async (reportId: string) => {
  const { error } = await supabase
    .from('generated_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw error;
};

// ========================================
// SCHEDULED REPORTS
// ========================================

export interface ScheduledReport {
  id: string;
  template_id: string;
  schedule_name: string;
  parameters: Record<string, any>;
  schedule_config: Record<string, any>;
  recipients: string[];
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_by: string;
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export const getScheduledReports = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('scheduled_reports')
    .select(`
      *,
      report_templates(name, category)
    `)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as (ScheduledReport & { report_templates: { name: string; category: string } })[];
};

export const createScheduledReport = async (
  schedule: Omit<ScheduledReport, 'id' | 'created_at' | 'updated_at'>
) => {
  const { data, error } = await supabase
    .from('scheduled_reports')
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledReport;
};

export const updateScheduledReport = async (
  scheduleId: string,
  updates: Partial<ScheduledReport>
) => {
  const { data, error } = await supabase
    .from('scheduled_reports')
    .update(updates)
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledReport;
};

export const deleteScheduledReport = async (scheduleId: string) => {
  const { error } = await supabase
    .from('scheduled_reports')
    .delete()
    .eq('id', scheduleId);

  if (error) throw error;
};

// ========================================
// SAVED FILTERS
// ========================================

export interface SavedFilter {
  id: string;
  user_id: string;
  filter_name: string;
  report_category?: string;
  filter_config: Record<string, any>;
  is_default: boolean;
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export const getSavedFilters = async (userId: string, organisationId: string, category?: string) => {
  let query = supabase
    .from('saved_filters')
    .select('*')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (category) {
    query = query.eq('report_category', category);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as SavedFilter[];
};

export const createSavedFilter = async (
  filter: Omit<SavedFilter, 'id' | 'created_at' | 'updated_at'>
) => {
  const { data, error } = await supabase
    .from('saved_filters')
    .insert(filter)
    .select()
    .single();

  if (error) throw error;
  return data as SavedFilter;
};

export const updateSavedFilter = async (
  filterId: string,
  updates: Partial<SavedFilter>
) => {
  const { data, error } = await supabase
    .from('saved_filters')
    .update(updates)
    .eq('id', filterId)
    .select()
    .single();

  if (error) throw error;
  return data as SavedFilter;
};

export const deleteSavedFilter = async (filterId: string) => {
  const { error } = await supabase
    .from('saved_filters')
    .delete()
    .eq('id', filterId);

  if (error) throw error;
};

// ========================================
// REPORT DATA AGGREGATION
// ========================================

export interface ReportDataRequest {
  templateId: string;
  parameters: Record<string, any>;
  organisationId: string;
}

export const getReportData = async (request: ReportDataRequest) => {
  // This function would contain the actual data aggregation logic
  // For now, return a placeholder implementation
  
  const { templateId, parameters, organisationId } = request;

  // Example implementation - this would be replaced with actual business logic
  switch (templateId) {
    case 'financial-cost-analysis':
      return getFinancialCostAnalysisData(parameters, organisationId);
    case 'projects-portfolio':
      return getProjectPortfolioData(parameters, organisationId);
    case 'inventory-stock-movement':
      return getInventoryStockMovementData(parameters, organisationId);
    case 'compliance-audit-trail':
      return getComplianceAuditTrailData(parameters, organisationId);
    default:
      throw new Error(`Unknown report template: ${templateId}`);
  }
};

// Mock data aggregation functions - these would be replaced with actual implementations
const getFinancialCostAnalysisData = async (parameters: any, organisationId: string) => {
  // Placeholder implementation
  return {
    summary: {
      totalBudget: 5000000,
      totalActual: 4500000,
      totalVariance: 500000,
      variancePercentage: 10
    },
    data: [
      { project_name: 'Project A', budget_amount: 1000000, actual_cost: 950000, variance: 50000, variance_percentage: 5 },
      { project_name: 'Project B', budget_amount: 2000000, actual_cost: 1800000, variance: 200000, variance_percentage: 10 },
      { project_name: 'Project C', budget_amount: 1500000, actual_cost: 1750000, variance: -250000, variance_percentage: -16.67 }
    ]
  };
};

const getProjectPortfolioData = async (parameters: any, organisationId: string) => {
  // Placeholder implementation
  return {
    summary: {
      totalProjects: 24,
      activeProjects: 18,
      completedProjects: 6,
      onScheduleProjects: 15
    },
    data: [
      { project_name: 'Project A', status: 'Active', start_date: '2024-01-01', end_date: '2024-06-30', completion_percentage: 65 },
      { project_name: 'Project B', status: 'Active', start_date: '2024-02-01', end_date: '2024-08-31', completion_percentage: 45 },
      { project_name: 'Project C', status: 'Completed', start_date: '2023-09-01', end_date: '2024-03-31', completion_percentage: 100 }
    ]
  };
};

const getInventoryStockMovementData = async (parameters: any, organisationId: string) => {
  // Placeholder implementation
  return {
    summary: {
      totalTransactions: 1247,
      totalInward: 678,
      totalOutward: 569,
      netMovement: 109
    },
    data: [
      { item_name: 'Material A', transaction_type: 'Inward', quantity: 100, location: 'Warehouse A', date: '2024-05-01' },
      { item_name: 'Material B', transaction_type: 'Outward', quantity: 50, location: 'Site B', date: '2024-05-02' },
      { item_name: 'Material C', transaction_type: 'Transfer', quantity: 25, location: 'Warehouse B', date: '2024-05-03' }
    ]
  };
};

const getComplianceAuditTrailData = async (parameters: any, organisationId: string) => {
  // Placeholder implementation
  return {
    summary: {
      totalActivities: 3421,
      todayActivities: 45,
      uniqueUsers: 23,
      criticalActions: 12
    },
    data: [
      { user_name: 'John Doe', action: 'CREATE', table_name: 'projects', record_id: 'proj-123', timestamp: '2024-05-05T10:30:00Z', ip_address: '192.168.1.100' },
      { user_name: 'Jane Smith', action: 'UPDATE', table_name: 'invoices', record_id: 'inv-456', timestamp: '2024-05-05T10:25:00Z', ip_address: '192.168.1.101' },
      { user_name: 'Bob Johnson', action: 'DELETE', table_name: 'materials', record_id: 'mat-789', timestamp: '2024-05-05T10:20:00Z', ip_address: '192.168.1.102' }
    ]
  };
};

// ========================================
// REPORT EXPORT
// ========================================

export const exportReportToPDF = async (reportId: string) => {
  // This would integrate with a PDF generation service
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: { reportId }
  });

  if (error) throw error;
  return data;
};

export const exportReportToExcel = async (reportId: string) => {
  // This would integrate with an Excel generation service
  const { data, error } = await supabase.functions.invoke('generate-excel', {
    body: { reportId }
  });

  if (error) throw error;
  return data;
};

// ========================================
// USAGE STATISTICS
// ========================================

export const getReportUsageStatistics = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('report_usage_statistics')
    .select('*')
    .order('generated_last_30_days', { ascending: false });

  if (error) throw error;
  return data;
};

export const getUserReportPreferences = async (userId: string, organisationId: string) => {
  const { data, error } = await supabase
    .from('user_report_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return data;
};

export const updateUserReportPreferences = async (
  userId: string,
  organisationId: string,
  preferences: Array<{ preference_key: string; preference_value: any; report_category?: string }>
) => {
  const upserts = preferences.map(pref => ({
    user_id: userId,
    organisation_id: organisationId,
    ...pref
  }));

  const { data, error } = await supabase
    .from('user_report_preferences')
    .upsert(upserts, { onConflict: 'user_id,report_category,preference_key' })
    .select();

  if (error) throw error;
  return data;
};
