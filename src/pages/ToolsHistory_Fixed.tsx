import React, { useState, useEffect } from 'react';
import { Search, Filter, FileText, Download, Eye, Calendar, ArrowUpDown } from 'lucide-react';
import { toolTransactionsApi, siteTransfersApi } from '../tools/api';
import { useAuth } from '../App';

// Professional Modal Design System Tokens
const DESIGN_TOKENS = {
  colors: {
    surface: {
      card: '#FFFFFF',
      page: '#F8F9FA',
    },
    border: '#E5E7EB',
    accent: '#DC2626',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    }
  },
  typography: {
    title: '1.125rem', // 18px
    label: '0.75rem',   // 12px
    input: '0.875rem',  // 14px
    button: '0.875rem', // 14px
    monospace: '0.8125rem', // 13px
  },
  spacing: {
    container: {
      standard: '640px',
      dataRich: '800px',
      dashboard: '1100px',
    },
    padding: {
      main: '1.25rem', // 20px
    },
    gap: {
      form: '1rem',      // 16px
      label: '0.375rem', // 6px
    }
  },
  borderRadius: {
    subtle: '0.375rem', // 6px
    none: '0px',
  },
};

interface HistoryItem {
  id: string;
  reference_id: string;
  transaction_date: string;
  transaction_type: string;
  client_name?: string;
  from_client_name?: string;
  to_client_name?: string;
  from_project_name?: string;
  to_project_name?: string;
  status: string;
  tool_count: number;
  remarks?: string;
}

export default function ToolsHistory() {
  const { organisation } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    transaction_type: '',
    status: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    if (organisation?.id) {
      loadHistory();
    }
  }, [organisation]);

  useEffect(() => {
    const filtered = history.filter(item => {
      // Search filter
      const matchesSearch = !searchTerm || 
        item.reference_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.from_client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.to_client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.from_project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.to_project_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filter filters
      const matchesType = !filters.transaction_type || item.transaction_type === filters.transaction_type;
      const matchesStatus = !filters.status || item.status === filters.status;
      const matchesDateFrom = !filters.date_from || new Date(item.transaction_date) >= new Date(filters.date_from);
      const matchesDateTo = !filters.date_to || new Date(item.transaction_date) <= new Date(filters.date_to);

      return matchesSearch && matchesType && matchesStatus && matchesDateFrom && matchesDateTo;
    });
    setFilteredHistory(filtered);
  }, [history, searchTerm, filters]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const orgId = organisation.id;

      // Get regular transactions
      const transactions = await toolTransactionsApi.getTransactions(orgId);
      
      // Get site transfers
      const siteTransfers = await siteTransfersApi.getSiteTransfers(orgId);

      // Combine and format history
      const combinedHistory: HistoryItem[] = [];

      // Add regular transactions - FIXED: Access properties directly from API response
      transactions.forEach(transaction => {
        combinedHistory.push({
          id: transaction.id,
          reference_id: transaction.reference_id,
          transaction_date: transaction.transaction_date,
          transaction_type: transaction.transaction_type,
          client_name: transaction.client_name || transaction.client?.name || '',
          from_client_name: transaction.from_client_name || transaction.from_client?.name || '',
          to_client_name: transaction.to_client_name || transaction.to_client?.name || '',
          status: transaction.status,
          tool_count: 0, // Will be updated with actual count
          remarks: transaction.remarks,
        });
      });

      // Add site transfers - FIXED: Access properties directly from API response
      siteTransfers.forEach(transfer => {
        combinedHistory.push({
          id: transfer.id,
          reference_id: transfer.reference_id,
          transaction_date: transfer.transfer_date,
          transaction_type: 'SITE_TRANSFER',
          from_project_name: transfer.from_project_name || transfer.from_project?.project_name || '',
          to_project_name: transfer.to_project_name || transfer.to_project?.project_name || '',
          status: transfer.status,
          tool_count: 0, // Will be updated with actual count
          remarks: transfer.reason_for_transfer,
        });
      });

      // Sort by date (most recent first)
      combinedHistory.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

      setHistory(combinedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'ACTIVE': 'text-green-600 bg-green-50',
      'IN_TRANSIT': 'text-orange-600 bg-orange-50',
      'COMPLETED': 'text-blue-600 bg-blue-50',
      'PARTIAL': 'text-yellow-600 bg-yellow-50',
      'RETURNED': 'text-gray-600 bg-gray-50',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  const getTransactionTypeColor = (type: string) => {
    const colors = {
      'ISSUE': 'text-blue-600 bg-blue-50',
      'RECEIVE': 'text-green-600 bg-green-50',
      'TRANSFER': 'text-orange-600 bg-orange-50',
      'SITE_TRANSFER': 'text-purple-600 bg-purple-50',
    };
    return colors[type as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      transaction_type: '',
      status: '',
      date_from: '',
      date_to: '',
    });
  };

  const downloadPDF = async (item: HistoryItem) => {
    try {
      // TODO: Implement PDF download based on transaction type
      console.log('Download PDF for:', item.reference_id);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tools History</h1>
            <p className="text-gray-600">Complete audit trail of all tool movements</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by reference ID, client, project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
              <select
                value={filters.transaction_type}
                onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="ISSUE">Issue</option>
                <option value="RECEIVE">Receive</option>
                <option value="TRANSFER">Transfer</option>
                <option value="SITE_TRANSFER">Site Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="COMPLETED">Completed</option>
                <option value="PARTIAL">Partial</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client/Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tools</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-900 mb-2">No history found</p>
                    <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-blue-600">{item.reference_id}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(item.transaction_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeColor(item.transaction_type)}`}>
                        {item.transaction_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.client_name || item.from_project_name || item.to_project_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.tool_count || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={item.remarks}>
                      {item.remarks || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => downloadPDF(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredHistory.length} of {history.length} records
      </div>
    </div>
  );
}
