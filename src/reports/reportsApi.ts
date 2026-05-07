import { supabase } from '../supabase';

// Financial Reports API
export interface FinancialData {
  project_name: string;
  budget_amount: number;
  actual_cost: number;
  variance: number;
  variance_percentage: number;
  start_date: string;
  end_date: string;
}

export const getFinancialReports = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    projectIds?: string[];
  }
) => {
  let query = supabase
    .from('projects')
    .select(`
      *,
      project_materials(
        id,
        name,
        quantity,
        unit_price,
        total_cost
      )
    `)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  // Apply date filters
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('created_at', startDate).lte('created_at', endDate);
  }

  // Apply project filter
  if (filters?.projectIds && filters.projectIds.length > 0) {
    query = query.in('id', filters.projectIds);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

export const getFinancialSummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    projectIds?: string[];
  }
) => {
  const projects = await getFinancialReports(organisationId, filters);
  
  const totalProjects = projects.length;
  const totalBudget = projects.reduce((sum, project) => sum + (project.budget_amount || 0), 0);
  const totalActual = projects.reduce((sum, project) => sum + (project.actual_cost || 0), 0);
  const totalVariance = totalBudget - totalActual;
  const averageVariancePercentage = totalProjects > 0 ? (totalVariance / totalBudget) * 100 : 0;

  return {
    totalProjects,
    totalBudget,
    totalActual,
    totalVariance,
    averageVariancePercentage
  };
};

// Project Reports API
export interface ProjectData {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  start_date: string;
  end_date?: string;
  completion_percentage: number;
  budget_amount: number;
  actual_cost: number;
  team_size: number;
  client_name: string;
}

export const getProjectReports = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    projectIds?: string[];
    status?: string[];
    clientIds?: string[];
  }
) => {
  let query = supabase
    .from('projects')
    .select(`
      *,
      clients(name),
      project_team(
        count(*) as team_size
      )
    `)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  // Apply date filters
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('created_at', startDate).lte('created_at', endDate);
  }

  // Apply project filter
  if (filters?.projectIds && filters.projectIds.length > 0) {
    query = query.in('id', filters.projectIds);
  }

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  // Apply client filter
  if (filters?.clientIds && filters.clientIds.length > 0) {
    query = query.in('client_id', filters.clientIds);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

export const getProjectSummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    projectIds?: string[];
    status?: string[];
    clientIds?: string[];
  }
) => {
  const projects = await getProjectReports(organisationId, filters);
  
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const onScheduleProjects = projects.filter(p => {
    if (!p.end_date) return false;
    const endDate = new Date(p.end_date);
    const today = new Date();
    return endDate >= today;
  }).length;
  const totalBudget = projects.reduce((sum, project) => sum + (project.budget_amount || 0), 0);
  const averageTeamSize = projects.reduce((sum, project) => sum + (project.team_size || 0), 0) / totalProjects;

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    onScheduleProjects,
    totalBudget,
    averageTeamSize
  };
};

// Inventory Reports API
export interface InventoryData {
  item_name: string;
  hsn_code?: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  unit_cost: number;
  total_value: number;
  location: string;
  last_updated: string;
}

export const getInventoryReports = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    locationIds?: string[];
    itemIds?: string[];
  }
) => {
  let query = supabase
    .from('materials')
    .select(`
      *,
      locations(name),
      stock_balances(
        quantity as current_stock,
        reserved_quantity,
        available_quantity
      )
    `)
    .eq('organisation_id', organisationId)
    .order('updated_at', { ascending: false });

  // Apply date filters
  if (filters?.dateFrom) {
    query = query.gte('updated_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('updated_at', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('updated_at', startDate).lte('updated_at', endDate);
  }

  // Apply location filter
  if (filters?.locationIds && filters.locationIds.length > 0) {
    query = query.in('location_id', filters.locationIds);
  }

  // Apply item filter
  if (filters?.itemIds && filters.itemIds.length > 0) {
    query = query.in('id', filters.itemIds);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

export const getInventorySummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    locationIds?: string[];
    itemIds?: string[];
  }
) => {
  const materials = await getInventoryReports(organisationId, filters);
  
  const totalItems = materials.length;
  const totalStock = materials.reduce((sum, item) => sum + (item.current_stock || 0), 0);
  const totalReserved = materials.reduce((sum, item) => sum + (item.reserved_stock || 0), 0);
  const totalAvailable = materials.reduce((sum, item) => sum + (item.available_quantity || 0), 0);
  const totalValue = materials.reduce((sum, item) => sum + ((item.current_stock || 0) * (item.unit_cost || 0)), 0);
  const lowStockItems = materials.filter(item => (item.available_quantity || 0) < 10).length;

  return {
    totalItems,
    totalStock,
    totalReserved,
    totalAvailable,
    totalValue,
    lowStockItems
  };
};

// Compliance Reports API
export interface ComplianceData {
  id: string;
  audit_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  resolved_at?: string;
  assigned_to?: string;
  created_by: string;
}

export const getComplianceReports = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    auditTypes?: string[];
    severity?: string[];
    status?: string[];
  }
) => {
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      auth_users(email) as created_by
    `)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  // Apply date filters
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('created_at', startDate).lte('created_at', endDate);
  }

  // Apply audit type filter
  if (filters?.auditTypes && filters.auditTypes.length > 0) {
    query = query.in('audit_type', filters.auditTypes);
  }

  // Apply severity filter
  if (filters?.severity && filters.severity.length > 0) {
    query = query.in('severity', filters.severity);
  }

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

export const getComplianceSummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    auditTypes?: string[];
    severity?: string[];
    status?: string[];
  }
) => {
  const audits = await getComplianceReports(organisationId, filters);
  
  const totalAudits = audits.length;
  const openAudits = audits.filter(audit => audit.status === 'open').length;
  const criticalAudits = audits.filter(audit => audit.severity === 'critical').length;
  const highAudits = audits.filter(audit => audit.severity === 'high').length;
  const resolvedAudits = audits.filter(audit => audit.status === 'resolved').length;
  const averageResolutionTime = audits
    .filter(audit => audit.status === 'resolved' && audit.resolved_at)
    .reduce((sum, audit) => {
      if (audit.resolved_at) {
        const created = new Date(audit.created_at);
        const resolved = new Date(audit.resolved_at);
        return sum + (resolved.getTime() - created.getTime());
      }
      return sum;
    }, 0) / audits.filter(audit => audit.status === 'resolved').length;

  return {
    totalAudits,
    openAudits,
    criticalAudits,
    highAudits,
    resolvedAudits,
    averageResolutionTime
  };
};

// Delivery Challan Reports API
export interface DeliveryChallanData {
  id: string;
  dc_number: string;
  client_name: string;
  project_name: string;
  delivery_date: string;
  status: 'draft' | 'in_transit' | 'delivered' | 'returned';
  total_items: number;
  total_value: number;
  vehicle_number?: string;
  driver_name?: string;
  created_at: string;
  delivered_at?: string;
}

export const getDeliveryChallanReports = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    status?: string[];
    clientIds?: string[];
    projectIds?: string[];
  }
) => {
  let query = supabase
    .from('delivery_challans')
    .select(`
      *,
      clients(name),
      projects(name)
    `)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  // Apply date filters
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  // Apply month/year filter
  if (filters?.month && filters?.year) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;
    query = query.gte('created_at', startDate).lte('created_at', endDate);
  }

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  // Apply client filter
  if (filters?.clientIds && filters.clientIds.length > 0) {
    query = query.in('client_id', filters.clientIds);
  }

  // Apply project filter
  if (filters?.projectIds && filters.projectIds.length > 0) {
    query = query.in('project_id', filters.projectIds);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any[];
};

export const getDeliveryChallanSummaryStats = async (
  organisationId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    month?: number;
    year?: number;
    status?: string[];
    clientIds?: string[];
    projectIds?: string[];
  }
) => {
  const dcs = await getDeliveryChallanReports(organisationId, filters);
  
  const totalDCs = dcs.length;
  const draftDCs = dcs.filter(dc => dc.status === 'draft').length;
  const inTransitDCs = dcs.filter(dc => dc.status === 'in_transit').length;
  const deliveredDCs = dcs.filter(dc => dc.status === 'delivered').length;
  const totalValue = dcs.reduce((sum, dc) => sum + (dc.total_value || 0), 0);
  const totalItems = dcs.reduce((sum, dc) => sum + (dc.total_items || 0), 0);

  return {
    totalDCs,
    draftDCs,
    inTransitDCs,
    deliveredDCs,
    totalValue,
    totalItems
  };
};

// Utility function to get filter options for all reports
export const getReportFilterOptions = async (organisationId: string) => {
  const [clients, projects, materials] = await Promise.all([
    supabase.from('clients').select('id, name').eq('organisation_id', organisationId),
    supabase.from('projects').select('id, name').eq('organisation_id', organisationId),
    supabase.from('materials').select('id, name').eq('organisation_id', organisationId)
  ]);

  return {
    clients: clients.data || [],
    projects: projects.data || [],
    materials: materials.data || []
  };
};
