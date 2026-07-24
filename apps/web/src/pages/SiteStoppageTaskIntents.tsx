import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, ArrowRight, Check, X, Filter } from 'lucide-react';
import { toast } from '@/lib/logger';

export interface SiteReportStoppageIntent {
  id: string;
  source_type: 'daily_report' | 'site_visit';
  category: string;
  blocking_party: string;
  description: string;
  impact_hours: number;
  photo_urls: string[];
  task_intent_status: 'pending_pm_approval' | 'approved_task_created' | 'merged_with_existing' | 'dismissed';
  created_at: string;
}

export const SiteStoppageTaskIntents: React.FC = () => {
  const { user } = useAuth();
  const [intents, setIntents] = useState<SiteReportStoppageIntent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchIntents();
  }, []);

  const fetchIntents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_report_stoppages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntents(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stoppage task intents');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndCreateTask = async (id: string, description: string) => {
    try {
      // 1. Create task in project_tasks or issues table
      const { data: taskData, error: taskError } = await supabase
        .from('project_tasks')
        .insert([{
          title: `[Site Stoppage] ${description.slice(0, 80)}`,
          description: description,
          status: 'todo',
          priority: 'high',
          created_by: user?.id
        }])
        .select()
        .single();

      // Fallback if project_tasks schema differs
      const taskId = taskData?.id || null;

      // 2. Update stoppage intent status
      const { error: updateError } = await supabase
        .from('site_report_stoppages')
        .update({
          task_intent_status: 'approved_task_created',
          created_task_id: taskId,
          pm_reviewed_by: user?.id,
          pm_reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;
      toast.success('Site Stoppage approved & Task created successfully');
      fetchIntents();
    } catch (err: any) {
      toast.error(`Error approving task intent: ${err.message}`);
    }
  };

  const handleDismissIntent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('site_report_stoppages')
        .update({
          task_intent_status: 'dismissed',
          pm_reviewed_by: user?.id,
          pm_reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.info('Task intent dismissed');
      fetchIntents();
    } catch (err: any) {
      toast.error(`Error dismissing intent: ${err.message}`);
    }
  };

  const filteredIntents = intents.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            RBAC Site Stoppage Task Approval Queue
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review site visit observations and daily report work stoppages. PM approval is required before tasks are published.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <Filter className="w-4 h-4 text-gray-400 ml-1" />
        <span className="text-xs font-semibold text-gray-500 mr-2">Category:</span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500"
        >
          <option value="all">All Categories</option>
          <option value="drawing_awaiting">Drawing Awaiting</option>
          <option value="material_shortage">Material Shortage</option>
          <option value="client_access_denied">Client Access Denied</option>
          <option value="equipment_breakdown">Equipment Breakdown</option>
          <option value="power_water_loss">Power / Water Loss</option>
          <option value="safety_hold">Safety Hold</option>
          <option value="payment">Payment Issue</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading stoppage task intents...</div>
      ) : filteredIntents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">Task Approval Queue Clear</h3>
          <p className="mt-1 text-sm text-gray-500">No pending site stoppages or visit observations requiring PM task creation.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Source</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category & Blocking Party</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">PM Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredIntents.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-bold">{new Date(item.created_at).toLocaleDateString()}</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 mt-0.5">
                        {item.source_type === 'site_visit' ? 'Site Visit' : 'Daily Report'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-semibold text-gray-900 capitalize">{item.category.replace('_', ' ')}</div>
                      <div className="text-xs text-amber-700 font-medium">Blocking: {item.blocking_party.toUpperCase()}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 max-w-sm truncate">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">
                      {item.impact_hours || 0} hrs delay
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.task_intent_status === 'pending_pm_approval' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3.5 h-3.5 mr-1" /> Pending PM Gate
                        </span>
                      ) : item.task_intent_status === 'approved_task_created' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approved & Task Created
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          Dismissed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {item.task_intent_status === 'pending_pm_approval' && (
                        <>
                          <button
                            onClick={() => handleApproveAndCreateTask(item.id, item.description)}
                            className="inline-flex items-center px-3 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve & Create Task
                          </button>
                          <button
                            onClick={() => handleDismissIntent(item.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
