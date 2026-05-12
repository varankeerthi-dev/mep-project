// Simple in-memory storage for tool transactions
// This will be replaced with actual database/API calls in production

interface ToolTransaction {
  id: string;
  reference_id: string;
  transaction_date: string;
  client_id?: string;
  from_client?: string;
  to_client?: string;
  from_project?: string;
  to_project?: string;
  transaction_type: 'ISSUE' | 'RECEIVE' | 'TRANSFER' | 'SITE_TRANSFER';
  status: 'ACTIVE' | 'IN_TRANSIT' | 'RETURNED' | 'COMPLETED';
  remarks?: string;
  source_place?: string;
  taken_by?: string;
  received_by?: string;
  transferred_by?: string;
  vehicle_number?: string;
  tools: ToolTransactionItem[];
  created_at: string;
}

interface ToolTransactionItem {
  id: string;
  tool_id?: string;
  tool_name: string;
  make: string;
  category?: string;
  quantity: number;
  returned_quantity?: number;
  hsn_code?: string;
  rate?: number;
}

class ToolTransactionStorage {
  private transactions: ToolTransaction[] = [];
  private static instance: ToolTransactionStorage;

  static getInstance(): ToolTransactionStorage {
    if (!ToolTransactionStorage.instance) {
      ToolTransactionStorage.instance = new ToolTransactionStorage();
    }
    return ToolTransactionStorage.instance;
  }

  // Create a new transaction
  createTransaction(data: Omit<ToolTransaction, 'id' | 'created_at'>): ToolTransaction {
    const transaction: ToolTransaction = {
      ...data,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    
    this.transactions.push(transaction);
    
    // Notify components that storage has changed
    window.dispatchEvent(new CustomEvent('storage-changed', {
      detail: { action: 'create', transaction }
    }));
    
    return transaction;
  }

  // Get all transactions
  getTransactions(): ToolTransaction[] {
    return this.transactions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Get transactions by type
  getTransactionsByType(type: ToolTransaction['transaction_type']): ToolTransaction[] {
    return this.transactions.filter(t => t.transaction_type === type);
  }

  // Get transactions by status
  getTransactionsByStatus(status: ToolTransaction['status']): ToolTransaction[] {
    return this.transactions.filter(t => t.status === status);
  }

  // Get issued tools (active issue transactions)
  getIssuedTools(): ToolTransaction[] {
    return this.transactions.filter(t => 
      t.transaction_type === 'ISSUE' && t.status === 'ACTIVE'
    );
  }

  // Get tools in transit
  getInTransitTools(): ToolTransaction[] {
    return this.transactions.filter(t => 
      ['IN_TRANSIT'].includes(t.status)
    );
  }

  // Update transaction status
  updateTransactionStatus(id: string, status: ToolTransaction['status']): boolean {
    const transaction = this.transactions.find(t => t.id === id);
    if (transaction) {
      transaction.status = status;
      return true;
    }
    return false;
  }

  // Get dashboard metrics
  getDashboardMetrics() {
    const totalTools = this.transactions.reduce((acc, t) => 
      acc + t.tools.reduce((sum, tool) => sum + tool.quantity, 0), 0
    );

    const issuedTools = this.getIssuedTools();
    const toolsAtClients = issuedTools.reduce((acc, t) => 
      acc + t.tools.reduce((sum, tool) => sum + tool.quantity, 0), 0
    );

    const inTransitTools = this.getInTransitTools();
    const toolsInTransit = inTransitTools.reduce((acc, t) => 
      acc + t.tools.reduce((sum, tool) => sum + tool.quantity, 0), 0
    );

    const returnedTools = this.getTransactionsByType('RECEIVE');
    const toolsReturned = returnedTools.reduce((acc, t) => 
      acc + (t.tools.reduce((sum, tool) => sum + (tool.returned_quantity || 0), 0)), 0
    );

    return {
      total_tools: totalTools,
      tools_at_clients: toolsAtClients,
      tools_at_warehouse: totalTools - toolsAtClients - toolsInTransit,
      tools_in_transit: toolsInTransit,
      tools_returned: toolsReturned,
      active_transactions: this.transactions.filter(t => 
        ['ACTIVE', 'IN_TRANSIT'].includes(t.status)
      ).length,
    };
  }

  // Get recent activity
  getRecentActivity(limit: number = 10) {
    return this.transactions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        type: t.transaction_type,
        description: this.getTransactionDescription(t),
        date: t.transaction_date,
        status: t.status,
        client: t.client_id || t.from_client || t.to_client || t.from_project || 'Unknown',
        tools_count: t.tools.length,
        total_quantity: t.tools.reduce((sum, tool) => sum + tool.quantity, 0),
      }));
  }

  private getTransactionDescription(transaction: ToolTransaction): string {
    const toolNames = transaction.tools.map(t => t.tool_name).slice(0, 2).join(', ');
    const moreCount = transaction.tools.length > 2 ? ` +${transaction.tools.length - 2} more` : '';
    
    switch (transaction.transaction_type) {
      case 'ISSUE':
        return `Issued ${toolNames}${moreCount} to ${transaction.client_id || 'client'}`;
      case 'RECEIVE':
        return `Received ${toolNames}${moreCount} from ${transaction.client_id || 'client'}`;
      case 'TRANSFER':
        return `Transferred ${toolNames}${moreCount} from ${transaction.from_client} to ${transaction.to_client}`;
      case 'SITE_TRANSFER':
        return `Site transfer ${toolNames}${moreCount} from ${transaction.from_project} to ${transaction.to_project}`;
      default:
        return `${transaction.transaction_type} transaction`;
    }
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Clear all data (for testing)
  clearAll(): void {
    this.transactions = [];
  }

  // Get storage size
  getStorageSize(): number {
    return this.transactions.length;
  }
}

export default ToolTransactionStorage;
export { ToolTransaction, ToolTransactionItem };
