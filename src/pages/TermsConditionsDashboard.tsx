import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Settings, Plus, Edit, Eye, Download, Search, Filter } from 'lucide-react';

interface TermsTemplate {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sections_count?: number;
  items_count?: number;
}

interface QuotationTerms {
  id: string;
  quotation_id: string;
  template_id?: string;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
  quotation?: {
    id: string;
    quotation_number: string;
    client_name?: string;
    project_name?: string;
    total_amount?: number;
  };
}

export const TermsConditionsDashboard: React.FC = () => {
  const { organisation } = useAuth();
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [recentQuotations, setRecentQuotations] = useState<QuotationTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'quotations'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load templates
      const { data: templatesData } = await supabase
        .from('terms_conditions_templates')
        .select('*')
        .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false });

      // Load recent quotations with custom terms
      const { data: quotationsData } = await supabase
        .from('quotation_terms_conditions')
        .select(`
          *,
          quotation:quotation_header(
            id, 
            quotation_number, 
            client:clients(name),
            project:projects(project_name),
            total_amount
          )
        `)
        .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false })
        .limit(10);

      setTemplates(templatesData || []);
      setRecentQuotations(quotationsData || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set fallback data if database is not available
      setTemplates([]);
      setRecentQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredQuotations = recentQuotations.filter(qt =>
    qt.quotation?.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    qt.quotation?.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    qt.quotation?.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading Terms & Conditions Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
        <p className="text-gray-600">Manage your quotation terms and conditions templates and usage</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Templates</p>
              <p className="text-2xl font-bold text-blue-900">{templates.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Active Templates</p>
              <p className="text-2xl font-bold text-green-900">
                {templates.filter(t => t.is_active).length}
              </p>
            </div>
            <Settings className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Custom Quotations</p>
              <p className="text-2xl font-bold text-purple-900">
                {recentQuotations.filter(qt => qt.is_custom).length}
              </p>
            </div>
            <Edit className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Total Usage</p>
              <p className="text-2xl font-bold text-orange-900">{recentQuotations.length}</p>
            </div>
            <Eye className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('quotations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'quotations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Recent Quotations ({recentQuotations.length})
          </button>
        </nav>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search templates, quotations, clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Templates */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Templates</h3>
            <div className="space-y-3">
              {filteredTemplates.slice(0, 5).map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {template.is_default && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                        {template.is_active && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(template.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No templates found</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Quotations */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Quotations with Custom T&C</h3>
            <div className="space-y-3">
              {filteredQuotations.slice(0, 5).map((qt) => (
                <div key={qt.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {qt.quotation?.quotation_number || 'Unknown Quotation'}
                      </h4>
                      <div className="text-sm text-gray-600 mt-1">
                        {qt.quotation?.client?.name && (
                          <span>Client: {qt.quotation.client.name}</span>
                        )}
                        {qt.quotation?.project?.project_name && (
                          <span className="ml-2">Project: {qt.quotation.project.project_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {qt.is_custom && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            Custom Terms
                          </span>
                        )}
                        {qt.quotation?.total_amount && (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            {new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR'
                            }).format(qt.quotation.total_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(qt.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredQuotations.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No quotations with custom terms found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">All Templates</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{template.name}</h4>
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    )}
                  </div>
                  <Settings className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  {template.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  {template.is_active && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-500">
                  <p>Created: {new Date(template.created_at).toLocaleDateString()}</p>
                  <p>Updated: {new Date(template.updated_at).toLocaleDateString()}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
                  <button className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100">
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm mt-2">Create your first template to get started</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'quotations' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Quotations with Custom Terms</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quotation #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotations.map((qt) => (
                  <tr key={qt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {qt.quotation?.quotation_number || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {qt.quotation?.client?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {qt.quotation?.project?.project_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {qt.is_custom ? (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          Custom
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          Template
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {qt.quotation?.total_amount ? (
                        new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR'
                        }).format(qt.quotation.total_amount)
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(qt.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button className="text-blue-600 hover:text-blue-900">View</button>
                        <button className="text-gray-600 hover:text-gray-900">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredQuotations.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No quotations found</p>
                <p className="text-sm mt-2">Quotations with custom terms will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
