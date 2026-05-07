import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  CheckIcon, 
  XMarkIcon, 
  PauseIcon, 
  ArrowRightIcon,
  EyeIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import { 
  Approval, 
  ApprovalActionRequest, 
  APPROVAL_TYPES, 
  APPROVAL_STATUS_CONFIG,
  APPROVAL_PRIORITY_CONFIG 
} from '../types/approvals';

interface ApprovalTableProps {
  approvals: Approval[];
  onAction: (approvalId: string, action: ApprovalActionRequest) => void;
  onView: (approval: Approval) => void;
  loading?: boolean;
}

const ApprovalTable: React.FC<ApprovalTableProps> = ({
  approvals,
  onAction,
  onView,
  loading = false
}) => {
  const [selectedApprovals, setSelectedApprovals] = useState<string[]>([]);
  const [actionComments, setActionComments] = useState<{ [key: string]: string }>({});

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedApprovals(approvals.map(a => a.id));
    } else {
      setSelectedApprovals([]);
    }
  };

  const handleSelectApproval = (approvalId: string, checked: boolean) => {
    if (checked) {
      setSelectedApprovals([...selectedApprovals, approvalId]);
    } else {
      setSelectedApprovals(selectedApprovals.filter(id => id !== approvalId));
    }
  };

  const handleAction = (approvalId: string, action: string) => {
    onAction(approvalId, {
      action: action as any,
      comments: actionComments[approvalId]
    });
    // Clear comments after action
    setActionComments({ ...actionComments, [approvalId]: '' });
  };

  const getApprovalTypeConfig = (type: string) => {
    return APPROVAL_TYPES.find(t => t.type === type) || APPROVAL_TYPES[0];
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getReferenceNumber = (approval: Approval) => {
    // This would need to be implemented based on reference_type
    // For now, return a generic reference
    return `${approval.reference_type.replace('_', '-')}-${approval.reference_id.slice(0, 8)}`;
  };

  if (loading) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-none">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-gray-200 rounded-none">
      {/* Bulk Actions */}
      {selectedApprovals.length > 0 && (
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">
              {selectedApprovals.length} approval{selectedApprovals.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => selectedApprovals.forEach(id => handleAction(id, 'APPROVED'))}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-none hover:bg-green-700"
              >
                Approve All
              </button>
              <button
                onClick={() => selectedApprovals.forEach(id => handleAction(id, 'REJECTED'))}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-none hover:bg-red-700"
              >
                Reject All
              </button>
              <button
                onClick={() => setSelectedApprovals([])}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded-none hover:bg-gray-700"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 w-12">
              <input
                type="checkbox"
                checked={selectedApprovals.length === approvals.length && approvals.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Reference No
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {approvals.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                No approvals found
              </td>
            </tr>
          ) : (
            approvals.map((approval) => {
              const typeConfig = getApprovalTypeConfig(approval.approval_type);
              const statusConfig = APPROVAL_STATUS_CONFIG[approval.status];
              const priorityConfig = APPROVAL_PRIORITY_CONFIG[approval.priority];
              
              return (
                <tr key={approval.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedApprovals.includes(approval.id)}
                      onChange={(e) => handleSelectApproval(approval.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {format(new Date(approval.created_at), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: typeConfig.color }}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {typeConfig.label}
                      </span>
                      {approval.priority !== 'NORMAL' && (
                        <span
                          className="ml-2 px-2 py-1 text-xs rounded-full text-white"
                          style={{ backgroundColor: priorityConfig.color }}
                        >
                          {priorityConfig.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      <div className="font-medium">{approval.title}</div>
                      {approval.description && (
                        <div className="text-gray-500 text-xs mt-1">
                          {approval.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {getReferenceNumber(approval)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {formatAmount(approval.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                      style={{
                        color: statusConfig.color,
                        backgroundColor: statusConfig.bgColor
                      }}
                    >
                      {statusConfig.label}
                    </span>
                    {approval.current_level < approval.max_levels && approval.status === 'PENDING' && (
                      <div className="text-xs text-gray-500 mt-1">
                        Level {approval.current_level} of {approval.max_levels}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* View Button */}
                      <button
                        onClick={() => onView(approval)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View Details"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>

                      {/* Action Buttons - Only show for pending approvals */}
                      {approval.status === 'PENDING' && (
                        <>
                          {/* Comments Input */}
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Comments..."
                              value={actionComments[approval.id] || ''}
                              onChange={(e) => setActionComments({
                                ...actionComments,
                                [approval.id]: e.target.value
                              })}
                              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-none"
                            />
                          </div>

                          {/* Approve Button */}
                          <button
                            onClick={() => handleAction(approval.id, 'APPROVED')}
                            className="p-1 text-green-600 hover:text-green-800"
                            title="Approve"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>

                          {/* Reject Button */}
                          <button
                            onClick={() => handleAction(approval.id, 'REJECTED')}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Reject"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>

                          {/* Hold Button */}
                          <button
                            onClick={() => handleAction(approval.id, 'HOLD')}
                            className="p-1 text-yellow-600 hover:text-yellow-800"
                            title="Hold"
                          >
                            <PauseIcon className="w-4 h-4" />
                          </button>

                          {/* Forward Button */}
                          <button
                            onClick={() => handleAction(approval.id, 'FORWARDED')}
                            className="p-1 text-purple-600 hover:text-purple-800"
                            title="Forward"
                          >
                            <ArrowRightIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* View Document Button */}
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View Document"
                      >
                        <DocumentIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ApprovalTable;
