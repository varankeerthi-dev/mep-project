import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, PlusIcon } from '@heroicons/react/24/outline';
import ApprovalTable from '../components/ApprovalTable';
import { 
  Approval, 
  ApprovalFilters, 
  ApprovalStats, 
  ApprovalActionRequest,
  ApprovalType,
  ApprovalStatus,
  ApprovalPriority,
  APPROVAL_TYPES,
  APPROVAL_STATUS_CONFIG,
  APPROVAL_PRIORITY_CONFIG
} from '../types/approvals';
import { ApprovalAPI } from '../approvals/api';

const Approvals: React.FC = () => {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ApprovalFilters>({});
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadApprovals();
    loadStats();
  }, [filters, searchTerm]);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const requestFilters = {
        ...filters,
        search: searchTerm || undefined
      };
      const response = await ApprovalAPI.getApprovalsForUser(requestFilters);
      
      if (response.success && response.data) {
        setApprovals(response.data);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await ApprovalAPI.getApprovalStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleApprovalAction = async (approvalId: string, action: ApprovalActionRequest) => {
    try {
      const response = await ApprovalAPI.processApproval(approvalId, action);
      if (response.success) {
        await loadApprovals();
        await loadStats();
        console.log(`Approval ${action.action} successfully`);
      } else {
        console.error('Error processing approval:', response.error);
      }
    } catch (error) {
      console.error('Error processing approval:', error);
    }
  };

  const handleViewApproval = (approval: Approval) => {
    setSelectedApproval(approval);
    setShowDetails(true);
  };

  const handleFilterChange = (filterType: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value !== undefined && 
      (Array.isArray(value) ? value.length > 0 : value !== '')
    ).length;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="bg-white border border-gray-200 rounded-none py-5">
        <div className="px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Approvals</h1>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-none hover:bg-blue-700">
              <PlusIcon className="w-4 h-4" />
              New Approval Request
            </button>
          </div>
          
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search approvals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-none ${
                getActiveFiltersCount() > 0 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {getActiveFiltersCount() > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-none p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="space-y-2">
                {Object.entries(APPROVAL_STATUS_CONFIG).map(([key, config]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.status?.includes(key as ApprovalStatus) || false}
                      onChange={(e) => {
                        const currentStatuses = filters.status || [];
                        if (e.target.checked) {
                          handleFilterChange('status', [...currentStatuses, key as ApprovalStatus]);
                        } else {
                          handleFilterChange('status', currentStatuses.filter(s => s !== key));
                        }
                      }}
                      className="rounded border-gray-300 mr-2"
                    />
                    <span className="text-sm text-gray-700">{config.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {APPROVAL_TYPES.map((type) => (
                  <label key={type.type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.type?.includes(type.type as ApprovalType) || false}
                      onChange={(e) => {
                        const currentTypes = filters.type || [];
                        if (e.target.checked) {
                          handleFilterChange('type', [...currentTypes, type.type as ApprovalType]);
                        } else {
                          handleFilterChange('type', currentTypes.filter(t => t !== type.type));
                        }
                      }}
                      className="rounded border-gray-300 mr-2"
                    />
                    <span className="text-sm text-gray-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="space-y-2">
                {Object.entries(APPROVAL_PRIORITY_CONFIG).map(([key, config]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.priority?.includes(key as ApprovalPriority) || false}
                      onChange={(e) => {
                        const currentPriorities = filters.priority || [];
                        if (e.target.checked) {
                          handleFilterChange('priority', [...currentPriorities, key as ApprovalPriority]);
                        } else {
                          handleFilterChange('priority', currentPriorities.filter(p => p !== key));
                        }
                      }}
                      className="rounded border-gray-300 mr-2"
                    />
                    <span className="text-sm text-gray-700">{config.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm"
                />
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm"
                />
                <button
                  onClick={clearFilters}
                  className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-none text-sm hover:bg-gray-300"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-7 gap-4">
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total_approvals}</div>
            <div className="text-sm text-gray-600">Total Approvals</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_approvals}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-green-600">{stats.approved_approvals}</div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-red-600">{stats.rejected_approvals}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.hold_approvals}</div>
            <div className="text-sm text-gray-600">On Hold</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.today_approvals}</div>
            <div className="text-sm text-gray-600">Today</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-none p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.week_approvals}</div>
            <div className="text-sm text-gray-600">This Week</div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-none">
        <ApprovalTable
          approvals={approvals}
          onAction={handleApprovalAction}
          onView={handleViewApproval}
          loading={loading}
        />
      </div>

      {showDetails && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Approval Details</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {APPROVAL_TYPES.find(t => t.type === selectedApproval.approval_type)?.label}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">
                    <span
                      className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                      style={{
                        color: APPROVAL_STATUS_CONFIG[selectedApproval.status].color,
                        backgroundColor: APPROVAL_STATUS_CONFIG[selectedApproval.status].bgColor
                      }}
                    >
                      {APPROVAL_STATUS_CONFIG[selectedApproval.status].label}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedApproval.amount 
                      ? new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          maximumFractionDigits: 0
                        }).format(selectedApproval.amount)
                      : '-'
                    }
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {APPROVAL_PRIORITY_CONFIG[selectedApproval.priority].label}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <div className="mt-1 text-sm text-gray-900">{selectedApproval.title}</div>
              </div>
              
              {selectedApproval.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <div className="mt-1 text-sm text-gray-900">{selectedApproval.description}</div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Requested Date</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {new Date(selectedApproval.requested_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Approval Level</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedApproval.current_level} of {selectedApproval.max_levels}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
