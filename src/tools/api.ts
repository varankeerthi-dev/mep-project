import { supabase } from '../supabase';

// Types
export interface ToolCatalog {
  id: string;
  organisation_id: string;
  tool_name: string;
  make?: string;
  model?: string;
  category?: string;
  purchase_price?: number;
  gst_rate?: number;
  depreciation_rate?: number;
  technical_specs?: string;
  custom_label_1_name?: string;
  custom_label_1_value?: string;
  custom_label_2_name?: string;
  custom_label_2_value?: string;
  custom_label_3_name?: string;
  custom_label_3_value?: string;
  custom_label_4_name?: string;
  custom_label_4_value?: string;
  initial_stock?: number;
  current_stock?: number;
  min_stock_level?: number;
  reorder_point?: number;
  default_source_location?: string;
  hsn_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ToolTransaction {
  id: string;
  organisation_id: string;
  reference_id: string;
  transaction_type: 'ISSUE' | 'RECEIVE' | 'TRANSFER' | 'SITE_TRANSFER';
  transaction_date: string;
  client_id?: string;
  from_client_id?: string;
  to_client_id?: string;
  taken_by?: string;
  received_by?: string;
  remarks?: string;
  status: 'ACTIVE' | 'RETURNED' | 'PARTIAL' | 'IN_TRANSIT';
  created_at?: string;
  updated_at?: string;
}

export interface ToolTransactionItem {
  id: string;
  transaction_id: string;
  tool_id: string;
  quantity: number;
  returned_quantity?: number;
  created_at?: string;
}

export interface SiteToolTransfer {
  id: string;
  organisation_id: string;
  reference_id: string;
  transfer_date: string;
  from_project_id?: string;
  to_project_id?: string;
  transferred_by?: string;
  received_by?: string;
  reason_for_transfer?: string;
  vehicle_number?: string;
  status: 'IN_TRANSIT' | 'COMPLETED';
  created_at?: string;
  updated_at?: string;
}

export interface ToolStockMovement {
  id: string;
  organisation_id: string;
  tool_id: string;
  transaction_id?: string;
  movement_type: 'OUT' | 'IN' | 'TRANSFER' | 'SITE_TRANSFER';
  quantity: number;
  location_type: 'WAREHOUSE' | 'CLIENT' | 'PROJECT';
  location_id?: string;
  balance_after: number;
  created_at?: string;
}

// Tools Catalog API
export const toolsApi = {
  // Get all tools for organisation
  async getTools(organisationId: string): Promise<ToolCatalog[]> {
    const { data, error } = await supabase
      .from('tools_catalog')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('tool_name');
    
    if (error) throw error;
    return data || [];
  },

  // Get tool by ID
  async getToolById(organisationId: string, toolId: string): Promise<ToolCatalog | null> {
    const { data, error } = await supabase
      .from('tools_catalog')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('id', toolId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create new tool
  async createTool(organisationId: string, toolData: Partial<ToolCatalog>): Promise<ToolCatalog> {
    const { data, error } = await supabase
      .from('tools_catalog')
      .insert({
        ...toolData,
        organisation_id: organisationId,
        current_stock: toolData.initial_stock || 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update tool
  async updateTool(organisationId: string, toolId: string, updates: Partial<ToolCatalog>): Promise<ToolCatalog> {
    const { data, error } = await supabase
      .from('tools_catalog')
      .update(updates)
      .eq('organisation_id', organisationId)
      .eq('id', toolId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete tool
  async deleteTool(organisationId: string, toolId: string): Promise<void> {
    const { error } = await supabase
      .from('tools_catalog')
      .delete()
      .eq('organisation_id', organisationId)
      .eq('id', toolId);
    
    if (error) throw error;
  },

  // Update stock levels
  async updateStock(organisationId: string, toolId: string, quantity: number): Promise<void> {
    const { error } = await supabase
      .from('tools_catalog')
      .update({ current_stock: quantity })
      .eq('organisation_id', organisationId)
      .eq('id', toolId);
    
    if (error) throw error;
  },

  // Get tools with low stock
  async getLowStockTools(organisationId: string): Promise<ToolCatalog[]> {
    const { data, error } = await supabase
      .from('tools_catalog')
      .select('*')
      .eq('organisation_id', organisationId)
      .lt('current_stock', 'min_stock_level')
      .order('tool_name');
    
    if (error) throw error;
    return data || [];
  },
};

// Tool Transactions API
export const toolTransactionsApi = {
  // Get all transactions
  async getTransactions(organisationId: string, filters?: {
    transaction_type?: string;
    client_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ToolTransaction[]> {
    let query = supabase
      .from('tool_transactions')
      .select(`
        *,
        client:clients!tool_transactions_client_id_fkey(name),
        from_client:clients!tool_transactions_from_client_id_fkey(name),
        to_client:clients!tool_transactions_to_client_id_fkey(name)
      `)
      .eq('organisation_id', organisationId);

    // Apply filters
    if (filters?.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type);
    }
    if (filters?.client_id) {
      query = query.or(`client_id.eq.${filters.client_id},to_client_id.eq.${filters.client_id}`);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.date_from) {
      query = query.gte('transaction_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('transaction_date', filters.date_to);
    }

    const { data, error } = await query.order('transaction_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get transaction by reference ID
  async getTransactionByRef(organisationId: string, referenceId: string): Promise<ToolTransaction | null> {
    const { data, error } = await supabase
      .from('tool_transactions')
      .select(`
        *,
        client:clients!tool_transactions_client_id_fkey(name),
        from_client:clients!tool_transactions_from_client_id_fkey(name),
        to_client:clients!tool_transactions_to_client_id_fkey(name)
      `)
      .eq('organisation_id', organisationId)
      .eq('reference_id', referenceId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create transaction
  async createTransaction(organisationId: string, transactionData: Partial<ToolTransaction>): Promise<ToolTransaction> {
    const { data, error } = await supabase
      .from('tool_transactions')
      .insert({
        ...transactionData,
        organisation_id: organisationId,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update transaction status
  async updateTransactionStatus(organisationId: string, transactionId: string, status: string): Promise<ToolTransaction> {
    const { data, error } = await supabase
      .from('tool_transactions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('organisation_id', organisationId)
      .eq('id', transactionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get transaction items
  async getTransactionItems(organisationId: string, transactionId: string): Promise<ToolTransactionItem[]> {
    const { data, error } = await supabase
      .from('tool_transaction_items')
      .select(`
        *,
        tool:tools_catalog(tool_name, make, hsn_code)
      `)
      .eq('transaction_id', transactionId);
    
    if (error) throw error;
    return data || [];
  },
};

// Site Transfers API
export const siteTransfersApi = {
  // Get all site transfers
  async getSiteTransfers(organisationId: string, filters?: {
    from_project_id?: string;
    to_project_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<SiteToolTransfer[]> {
    let query = supabase
      .from('site_tool_transfers')
      .select(`
        *,
        from_project:projects(project_name),
        to_project:projects(project_name)
      `)
      .eq('organisation_id', organisationId);

    // Apply filters
    if (filters?.from_project_id) {
      query = query.eq('from_project_id', filters.from_project_id);
    }
    if (filters?.to_project_id) {
      query = query.eq('to_project_id', filters.to_project_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.date_from) {
      query = query.gte('transfer_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('transfer_date', filters.date_to);
    }

    const { data, error } = await query.order('transfer_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Create site transfer
  async createSiteTransfer(organisationId: string, transferData: Partial<SiteToolTransfer>): Promise<SiteToolTransfer> {
    const { data, error } = await supabase
      .from('site_tool_transfers')
      .insert({
        ...transferData,
        organisation_id: organisationId,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update site transfer status
  async updateSiteTransferStatus(organisationId: string, transferId: string, status: string): Promise<SiteToolTransfer> {
    const { data, error } = await supabase
      .from('site_tool_transfers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('organisation_id', organisationId)
      .eq('id', transferId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// Stock Movements API
export const stockMovementsApi = {
  // Get stock movements
  async getStockMovements(organisationId: string, filters?: {
    tool_id?: string;
    movement_type?: string;
    location_type?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ToolStockMovement[]> {
    let query = supabase
      .from('tool_stock_movements')
      .select(`
        *,
        tool:tools_catalog(tool_name, make)
      `)
      .eq('organisation_id', organisationId);

    // Apply filters
    if (filters?.tool_id) {
      query = query.eq('tool_id', filters.tool_id);
    }
    if (filters?.movement_type) {
      query = query.eq('movement_type', filters.movement_type);
    }
    if (filters?.location_type) {
      query = query.eq('location_type', filters.location_type);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get stock breakdown for a tool
  async getStockBreakdown(organisationId: string, toolId: string): Promise<{
    total_stock: number;
    warehouse_stock: number;
    client_stock: number;
    project_stock: number;
    in_transit: number;
  }> {
    // Get current stock
    const { data: tool } = await supabase
      .from('tools_catalog')
      .select('current_stock')
      .eq('organisation_id', organisationId)
      .eq('id', toolId)
      .single();

    // Get stock movements
    const { data: movements } = await supabase
      .from('tool_stock_movements')
      .select('movement_type, location_type, quantity')
      .eq('organisation_id', organisationId)
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Calculate breakdown
    let warehouse_stock = 0;
    let client_stock = 0;
    let project_stock = 0;
    let in_transit = 0;

    movements?.forEach(movement => {
      if (movement.movement_type === 'OUT') {
        if (movement.location_type === 'WAREHOUSE') warehouse_stock -= movement.quantity;
        if (movement.location_type === 'CLIENT') client_stock -= movement.quantity;
        if (movement.location_type === 'PROJECT') project_stock -= movement.quantity;
      } else if (movement.movement_type === 'IN') {
        if (movement.location_type === 'WAREHOUSE') warehouse_stock += movement.quantity;
        if (movement.location_type === 'CLIENT') client_stock += movement.quantity;
        if (movement.location_type === 'PROJECT') project_stock += movement.quantity;
      }
    });

    return {
      total_stock: tool?.current_stock || 0,
      warehouse_stock,
      client_stock,
      project_stock,
      in_transit,
    };
  },
};

// Reference ID Generation
export const generateReferenceId = async (organisationId: string): Promise<string> => {
  const { data, error } = await supabase
    .rpc('generate_tools_reference_id', { p_org_id: organisationId });
  
  if (error) throw error;
  return data || '';
};
