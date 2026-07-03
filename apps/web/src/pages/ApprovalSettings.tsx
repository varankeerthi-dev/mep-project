import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { ApprovalSettingsAPI, ApprovalApprover, ApprovalSetting } from '../approvals/settings-api';
import { APPROVAL_TYPES } from '../types/approvals';

const ApprovalSettings: React.FC = () => {
  const [approvers, setApprovers] = useState<ApprovalApprover[]>([]);
  const [settings, setSettings] = useState<ApprovalSetting[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState<ApprovalApprover | null>(null);
  const [activeTab, setActiveTab] = useState<'approvers' | 'settings'>('approvers');

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    designation: '',
    department: '',
    email_address: '',
    phone_number: '',
    approval_types: [] as string[],
    max_approval_amount: 0,
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [approversRes, settingsRes, employeesRes, designationsRes] = await Promise.all([
        ApprovalSettingsAPI.getApprovers(),
        ApprovalSettingsAPI.getApprovalSettings(),
        ApprovalSettingsAPI.getEmployees(),
        ApprovalSettingsAPI.getDesignations()
      ]);

      if (approversRes.success) {
        setApprovers(approversRes.data || []);
      }
      if (settingsRes.success) {
        setSettings(settingsRes.data || []);
      }
      if (employeesRes.success) {
        setEmployees(employeesRes.data || []);
      }
      if (designationsRes.success) {
        setDesignations(designationsRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddApprover = async () => {
    try {
      const result = await ApprovalSettingsAPI.addApprover(formData);
      if (result.success) {
        setShowAddModal(false);
        resetForm();
        loadData();
      } else {
        alert(result.error || 'Failed to add approver');
      }
    } catch (error) {
      console.error('Error adding approver:', error);
    }
  };

  const handleUpdateApprover = async () => {
    if (!selectedApprover) return;
    
    try {
      const result = await ApprovalSettingsAPI.updateApprover(selectedApprover.id, formData);
      if (result.success) {
        setShowEditModal(false);
        setSelectedApprover(null);
        resetForm();
        loadData();
      } else {
        alert(result.error || 'Failed to update approver');
      }
    } catch (error) {
      console.error('Error updating approver:', error);
    }
  };

  const handleDeleteApprover = async (approverId: string) => {
    if (!confirm('Are you sure you want to remove this approver?')) return;
    
    try {
      const result = await ApprovalSettingsAPI.deleteApprover(approverId);
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to delete approver');
      }
    } catch (error) {
      console.error('Error deleting approver:', error);
    }
  };

  const handleToggleStatus = async (approverId: string, currentStatus: boolean) => {
    try {
      const result = await ApprovalSettingsAPI.toggleApproverStatus(approverId, !currentStatus);
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to update approver status');
      }
    } catch (error) {
      console.error('Error toggling approver status:', error);
    }
  };

  const handleSettingChange = async (settingKey: string, settingValue: string) => {
    try {
      const result = await ApprovalSettingsAPI.updateApprovalSetting(settingKey, settingValue);
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const openEditModal = (approver: ApprovalApprover) => {
    setSelectedApprover(approver);
    setFormData({
      user_id: approver.user_id,
      designation: approver.designation,
      department: approver.department || '',
      email_address: approver.email_address || '',
      phone_number: approver.phone_number || '',
      approval_types: approver.approval_types || [],
      max_approval_amount: approver.max_approval_amount || 0,
      is_active: approver.is_active
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      designation: '',
      department: '',
      email_address: '',
      phone_number: '',
      approval_types: [],
      max_approval_amount: 0,
      is_active: true
    });
  };

  const getSettingValue = (key: string) => {
    const setting = settings.find(s => s.setting_key === key);
    return setting?.setting_value || '';
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading approval settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border border-zinc-200 rounded-none py-5">
        <div className="px-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Approval Settings</h1>
          <p className="text-zinc-600 mt-2">Manage approvers and configure approval workflows</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-zinc-200 rounded-none">
        <div className="flex border-b border-zinc-200">
          <button
            onClick={() => setActiveTab('approvers')}
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === 'approvers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Approvers
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium text-sm border-b-2 ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Approvers Tab */}
        {activeTab === 'approvers' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-zinc-900">Approval Approvers</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-none hover:bg-blue-700"
              >
                <PlusIcon className="w-4 h-4" />
                Add Approver
              </button>
            </div>

            {/* Approvers Table */}
            <div className="overflow-x-auto">
              <table className="w-full bg-white border border-zinc-200 rounded-none">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Approval Types
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Max Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {approvers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No approvers configured yet
                      </td>
                    </tr>
                  ) : (
                    approvers.map((approver) => (
                      <tr key={approver.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {approver.user_avatar && (
                              <img
                                src={approver.user_avatar}
                                alt={approver.user_name}
                                className="w-8 h-8 rounded-full mr-3"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-zinc-900">
                                {approver.user_name}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {approver.user_email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-900">
                          {approver.designation}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-900">
                          {approver.department || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {approver.approval_types.map((type) => (
                              <span
                                key={type}
                                className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                              >
                                {APPROVAL_TYPES.find(t => t.type === type)?.label || type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-900">
                          {approver.max_approval_amount ? formatAmount(approver.max_approval_amount) : 'Unlimited'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              approver.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {approver.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleStatus(approver.id, approver.is_active)}
                              className="p-1 text-zinc-400 hover:text-zinc-600"
                              title={approver.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {approver.is_active ? (
                                <XCircleIcon className="w-4 h-4" />
                              ) : (
                                <CheckCircleIcon className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openEditModal(approver)}
                              className="p-1 text-zinc-400 hover:text-zinc-600"
                              title="Edit"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteApprover(approver.id)}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
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
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-6">Approval System Settings</h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Enable/Disable Approval System */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Enable Approval System
                </label>
                <select
                  value={getSettingValue('approval_enabled')}
                  onChange={(e) => handleSettingChange('approval_enabled', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              {/* Email Notifications */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Email Notifications
                </label>
                <select
                  value={getSettingValue('email_notifications')}
                  onChange={(e) => handleSettingChange('email_notifications', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              {/* SMS Notifications */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  SMS Notifications
                </label>
                <select
                  value={getSettingValue('sms_notifications')}
                  onChange={(e) => handleSettingChange('sms_notifications', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              {/* Auto Escalation Hours */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Auto Escalation Hours (for urgent approvals)
                </label>
                <input
                  type="number"
                  value={getSettingValue('auto_escalation_hours')}
                  onChange={(e) => handleSettingChange('auto_escalation_hours', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="168"
                />
              </div>

              {/* Approval Timeout Hours */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Approval Timeout Hours
                </label>
                <input
                  type="number"
                  value={getSettingValue('approval_timeout_hours')}
                  onChange={(e) => handleSettingChange('approval_timeout_hours', e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="168"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Approver Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900">
                {showEditModal ? 'Edit Approver' : 'Add New Approver'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Employee Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Select Employee *
                  </label>
                  <select
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Designation */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Designation *
                  </label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select designation</option>
                    {designations.map((designation) => (
                      <option key={designation} value={designation}>
                        {designation}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Operations, Finance"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email_address}
                    onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Override employee email if needed"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 98765 43210"
                  />
                </div>

                {/* Max Approval Amount */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Max Approval Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.max_approval_amount}
                    onChange={(e) => setFormData({ ...formData, max_approval_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0 for unlimited"
                    min="0"
                  />
                </div>
              </div>

              {/* Approval Types */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Approval Types *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {APPROVAL_TYPES.map((type) => (
                    <label key={type.type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.approval_types.includes(type.type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              approval_types: [...formData.approval_types, type.type]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              approval_types: formData.approval_types.filter(t => t !== type.type)
                            });
                          }
                        }}
                        className="rounded border-zinc-300 mr-2"
                      />
                      <span className="text-sm text-zinc-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active Status */}
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-zinc-300 mr-2"
                  />
                  <span className="text-sm text-zinc-700">Active</span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-zinc-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-none hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? handleUpdateApprover : handleAddApprover}
                className="px-4 py-2 bg-blue-600 text-white rounded-none hover:bg-blue-700"
              >
                {showEditModal ? 'Update Approver' : 'Add Approver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalSettings;
