import React from 'react';
import { FileText, Settings, Plus, Edit, Eye, Download, Search } from 'lucide-react';

export const TermsConditionsDashboard: React.FC = () => {
  return (
    <div className="p-6 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Terms & Conditions</h1>
        <p className="text-zinc-600">Manage your quotation terms and conditions templates and usage</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Templates</p>
              <p className="text-2xl font-bold text-blue-900">0</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Active Templates</p>
              <p className="text-2xl font-bold text-green-900">0</p>
            </div>
            <Settings className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Custom Quotations</p>
              <p className="text-2xl font-bold text-purple-900">0</p>
            </div>
            <Edit className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Total Usage</p>
              <p className="text-2xl font-bold text-orange-900">0</p>
            </div>
            <Eye className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 mb-6">
        <nav className="flex space-x-8">
          <button className="py-2 px-1 border-b-2 font-medium text-sm border-blue-500 text-blue-600">
            Overview
          </button>
          <button className="py-2 px-1 border-b-2 font-medium text-sm border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300">
            Templates (0)
          </button>
          <button className="py-2 px-1 border-b-2 font-medium text-sm border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300">
            Recent Quotations (0)
          </button>
        </nav>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search templates, quotations, clients..."
            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Overview Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Templates */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Recent Templates</h3>
          <div className="text-center py-8 text-zinc-400">
            <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
            <p>No templates found</p>
            <p className="text-sm mt-2">Create your first template to get started</p>
            <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto">
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>

        {/* Recent Quotations */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Recent Quotations with Custom T&C</h3>
          <div className="text-center py-8 text-zinc-400">
            <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
            <p>No quotations with custom terms found</p>
            <p className="text-sm mt-2">Quotations with custom terms will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
};
